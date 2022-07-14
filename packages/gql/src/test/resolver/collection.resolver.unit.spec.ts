import { Connection } from 'typeorm'

const sharedLibs = jest.requireActual('@nftcom/shared')

import { ethers } from 'ethers'

import { testDBConfig } from '@nftcom/gql/config'
import { db, defs } from '@nftcom/shared'

import { testMockUser, testMockWallet } from '../util/constants'
import { getTestApolloServer } from '../util/testApolloServer'

jest.setTimeout(120000)

jest.mock('@nftcom/gql/service/cache.service', () => ({
  cache: jest.fn(),
  createCacheConnection: jest.fn(),
}))

jest.mock('@nftcom/shared', () => {
  return {
    ...sharedLibs,
  }
})

let testServer
let connection: Connection

const userId = 'PGclc8YIzPCQzs8n_4gcb-3lbQXXb'
const walletId = '9qE9dsueMEQuhtdzQ8J2p'
let nftA, nftB, nftC

const repositories = db.newRepositories()

const clearCollectionEdge = async (): Promise<void> => {
  const collections = await repositories.collection.findAll()
  const edges = await repositories.edge.findAll()
  const collectionIds = collections.map((collection) => collection.id)
  const edgeIds = edges.map((edge) => edge.id)
  await repositories.collection.hardDeleteByIds(collectionIds)
  await repositories.edge.hardDeleteByIds(edgeIds)
}

describe('collection resolver', () => {
  beforeAll(async () => {
    connection = await db.connectTestDB(testDBConfig)

    testServer = getTestApolloServer(repositories,
      testMockUser,
      testMockWallet,
    )

    nftA = await repositories.nft.save({
      userId,
      walletId,
      contract:ethers.utils.getAddress('0xf5de760f2e916647fd766B4AD9E85ff943cE3A2b'),
      tokenId: '0x086a79',
      type: defs.NFTType.ERC721,
      metadata: {
        name: 'MultiFaucet Test NFT',
        description: 'A test NFT dispensed from faucet.paradigm.xyz.',
      },
    })
    nftB = await repositories.nft.save({
      userId,
      walletId,
      contract:ethers.utils.getAddress('0xf5de760f2e916647fd766B4AD9E85ff943cE3A2b'),
      tokenId: '0x086a76',
      type: defs.NFTType.ERC721,
      metadata: {
        name: 'MultiFaucet Test NFT',
        description: 'A test NFT dispensed from faucet.paradigm.xyz.',
      },
    })
    nftC = await repositories.nft.save({
      userId,
      walletId,
      contract:ethers.utils.getAddress('0x91BEB9f3576F8932722153017EDa8aEf9A0B4A77'),
      tokenId: '0x05',
      type: defs.NFTType.ERC721,
      metadata: {
        name: 'The Elon Musk Twitter Experience #5',
        description: 'MuskTweetz, Elon Musk, Tesla, OmniRhinos, OxPokemon, JellyFarm NFT Collection, Stoptrippin all Rights Reserved.',
      },
    })
  })

  afterAll(async () => {
    const nfts = await repositories.nft.findAll()
    const nftIds = nfts.map((nft) => nft.id)
    await repositories.nft.hardDeleteByIds(nftIds)

    await testServer.stop()

    if (!connection) return
    await connection.close()
  })

  describe('removeDuplicates', () => {
    beforeAll(async () => {
      const collectionA = await repositories.collection.save({
        contract: ethers.utils.getAddress('0xf5de760f2e916647fd766B4AD9E85ff943cE3A2b'),
        name: 'MultiFaucet NFT',
      })
      const collectionB = await repositories.collection.save({
        contract: ethers.utils.getAddress('0x91BEB9f3576F8932722153017EDa8aEf9A0B4A77'),
        name: 'tinyMusktweetz',
      })

      await repositories.edge.save({
        thisEntityType: defs.EntityType.Collection,
        thatEntityType: defs.EntityType.NFT,
        thisEntityId: collectionA.id,
        thatEntityId: nftA.id,
        edgeType: defs.EdgeType.Includes,
      })

      await repositories.edge.save({
        thisEntityType: defs.EntityType.Collection,
        thatEntityType: defs.EntityType.NFT,
        thisEntityId: collectionA.id,
        thatEntityId: nftB.id,
        edgeType: defs.EdgeType.Includes,
      })

      await repositories.edge.save({
        thisEntityType: defs.EntityType.Collection,
        thatEntityType: defs.EntityType.NFT,
        thisEntityId: collectionB.id,
        thatEntityId: nftC.id,
        edgeType: defs.EdgeType.Includes,
      })
    })

    afterAll(async () => {
      await clearCollectionEdge()
    })

    it('should remove duplicated collections', async () => {
      let result = await testServer.executeOperation({
        query: 'mutation removeDuplicates($contracts: [Address!]!) { removeDuplicates(contracts: $contracts) { message } }',
        variables: {
          contracts: ['0xf5de760f2e916647fd766B4AD9E85ff943cE3A2b', '0x91BEB9f3576F8932722153017EDa8aEf9A0B4A77'],
        },
      })

      expect(result.data.removeDuplicates.message).toBeDefined()
      expect(result.data.removeDuplicates.message).toEqual('No duplicates found')
      const existingCollections = await repositories.collection.findAll()
      expect(existingCollections.length).toEqual(2)

      result = await testServer.executeOperation({
        query: 'query CollectionNFTs($input: CollectionNFTsInput!) { collectionNFTs(input: $input) { items { id contract } } }',
        variables: {
          input: {
            collectionAddress: '0xf5de760f2e916647fd766B4AD9E85ff943cE3A2b',
            pageInput: {
              first: 5,
            },
          },
        },
      })

      expect(result.data.collectionNFTs.items.length).toBeDefined()
      expect(result.data.collectionNFTs.items.length).toEqual(2)
    })
  })

  describe('syncCollectionsWithNFTs', () => {
    afterAll(async () => {
      await clearCollectionEdge()
    })

    it('should sync collections with nfts', async () => {
      const result = await testServer.executeOperation({
        query: 'mutation SyncCollectionsWithNFTs($count: Int!) { syncCollectionsWithNFTs(count: $count) { message } }',
        variables: {
          count: 100,
        },
      })

      expect(result.data.syncCollectionsWithNFTs.message).toBeDefined()
      expect(result.data.syncCollectionsWithNFTs.message).toEqual('Saved new 2 collections')
      const collections = await repositories.collection.findAll()
      expect(collections.length).toEqual(2)
      const edges = await repositories.edge.findAll()
      expect(edges.length).toEqual(3)
    })
  })
})
