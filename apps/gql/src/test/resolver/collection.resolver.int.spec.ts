import { DataSource } from 'typeorm'

const sharedLibs = jest.requireActual('@nftcom/shared')

import { ethers } from 'ethers'
import * as fs from 'fs'
import { join } from 'path'

import Upload = require('graphql-upload/Upload.js')

import { testDBConfig } from '@nftcom/misc'
import { db, defs } from '@nftcom/shared'
import { EdgeType, EntityType } from '@nftcom/shared/defs'

import { testMockUser, testMockWallet } from '../util/constants'
import { clearDB } from '../util/helpers'
import { getTestApolloServer } from '../util/testApolloServer'

jest.setTimeout(500000)

jest.mock('@nftcom/gql/service/searchEngine.service', () => {
  return {
    SearchEngineService: jest.fn().mockImplementation(() => {
      return {
        indexCollections: jest.fn().mockResolvedValue(true),
        deleteCollections: jest.fn().mockResolvedValue(true),
        deleteNFT: jest.fn().mockResolvedValue(true),
      }
    }),
  }
})

jest.mock('@nftcom/cache', () => ({
  redisConfig: {},
  cache: {
    get: jest.fn(),
    set: jest.fn(),
    zscore: jest.fn().mockReturnValue(0),
    zadd: jest.fn(),
  },
  CacheKeys: {
    REFRESH_NFT_ORDERS_EXT: 'refresh_nft_orders_ext_test',
    REFRESHED_NFT_ORDERS_EXT: 'refreshed_nft_orders_ext_test',
  },
  createCacheConnection: jest.fn(),
}))

jest.mock('@nftcom/shared', () => {
  return {
    ...sharedLibs,
  }
})

let testServer
let connection: DataSource

const userId = 'PGclc8YIzPCQzs8n_4gcb-3lbQXXb'
const walletId = '9qE9dsueMEQuhtdzQ8J2p'
const chainId = '5'
let nftA, nftB, nftC
let cA, cB
let profile

const repositories = db.newRepositories()

describe('collection resolver', () => {
  beforeAll(async () => {
    connection = await db.connectTestDB(testDBConfig)

    testServer = getTestApolloServer(repositories, testMockUser, testMockWallet)
  })

  afterAll(async () => {
    await clearDB(repositories)

    await testServer.stop()

    if (!connection) return
    await connection.destroy()
  })

  describe('removeDuplicates', () => {
    beforeAll(async () => {
      nftA = await repositories.nft.save({
        userId,
        walletId,
        chainId,
        contract: ethers.utils.getAddress('0xf5de760f2e916647fd766B4AD9E85ff943cE3A2b'),
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
        chainId,
        contract: ethers.utils.getAddress('0xf5de760f2e916647fd766B4AD9E85ff943cE3A2b'),
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
        chainId,
        contract: ethers.utils.getAddress('0xe0060010c2c81A817f4c52A9263d4Ce5c5B66D55'),
        tokenId: '0x05',
        type: defs.NFTType.ERC721,
        metadata: {
          name: 'The Elon Musk Twitter Experience #5',
          description:
            'MuskTweetz, Elon Musk, Tesla, OmniRhinos, OxPokemon, JellyFarm NFT Collection, Stoptrippin all Rights Reserved.',
        },
      })
      const collectionA = await repositories.collection.save({
        contract: ethers.utils.getAddress('0xf5de760f2e916647fd766B4AD9E85ff943cE3A2b'),
        name: 'MultiFaucet NFT',
        chainId,
        deployer: '0x59495589849423692778a8c5aaCA62CA80f875a4',
      })
      const collectionB = await repositories.collection.save({
        contract: ethers.utils.getAddress('0xe0060010c2c81A817f4c52A9263d4Ce5c5B66D55'),
        name: 'tinyMusktweetz',
        chainId,
        deployer: '0x59495589849423692778a8c5aaCA62CA80f875a4',
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
      await clearDB(repositories)
    })

    it('should remove duplicated collections', async () => {
      let result = await testServer.executeOperation({
        query:
          'mutation removeDuplicates($contracts: [Address!]!) { removeDuplicates(contracts: $contracts) { message } }',
        variables: {
          contracts: ['0xf5de760f2e916647fd766B4AD9E85ff943cE3A2b', '0xe0060010c2c81A817f4c52A9263d4Ce5c5B66D55'],
        },
      })

      expect(result.data.removeDuplicates.message).toBeDefined()
      expect(result.data.removeDuplicates.message).toEqual('No duplicates found')
      const existingCollections = await repositories.collection.findAll()
      expect(existingCollections.length).toEqual(2)

      result = await testServer.executeOperation({
        query:
          'query CollectionNFTs($input: CollectionNFTsInput!) { collectionNFTs(input: $input) { items { id contract } } }',
        variables: {
          input: {
            collectionAddress: '0xf5de760f2e916647fd766B4AD9E85ff943cE3A2b',
            pageInput: {
              first: 5,
            },
            chainId: '5',
          },
        },
      })

      expect(result.data.collectionNFTs.items.length).toBeDefined()
      expect(result.data.collectionNFTs.items.length).toEqual(2)
    })
  })

  describe('collectionsByDeployer', () => {
    it('should return collections by deployer', async () => {
      const result = await testServer.executeOperation({
        query: `
        query DeployedCollections($deployer: String!) {
          collectionsByDeployer(deployer: $deployer) {
            contract
            name
          }
        }
        `,
        variables: {
          deployer: '0x59495589849423692778a8c5aaCA62CA80f875a4',
        },
      })

      expect(result.data.collectionsByDeployer.length).toBeDefined()
    })
  })

  describe('syncCollectionsWithNFTs', () => {
    beforeAll(async () => {
      await repositories.nft.save({
        userId,
        walletId,
        chainId,
        contract: ethers.utils.getAddress('0xf5de760f2e916647fd766B4AD9E85ff943cE3A2b'),
        tokenId: '0x086a79',
        type: defs.NFTType.ERC721,
        metadata: {
          name: 'MultiFaucet Test NFT',
          description: 'A test NFT dispensed from faucet.paradigm.xyz.',
        },
      })
      await repositories.nft.save({
        userId,
        walletId,
        chainId,
        contract: ethers.utils.getAddress('0xe0060010c2c81A817f4c52A9263d4Ce5c5B66D55'),
        tokenId: '0x05',
        type: defs.NFTType.ERC721,
        metadata: {
          name: 'The Elon Musk Twitter Experience #5',
          description:
            'MuskTweetz, Elon Musk, Tesla, OmniRhinos, OxPokemon, JellyFarm NFT Collection, Stoptrippin all Rights Reserved.',
        },
      })
    })
    afterAll(async () => {
      await clearDB(repositories)
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
      expect(edges.length).toEqual(2)
    })
  })

  describe('updateCollectionImageUrls', () => {
    beforeAll(async () => {
      testServer = getTestApolloServer(repositories, testMockUser, testMockWallet)
      cA = await repositories.collection.save({
        contract: ethers.utils.getAddress('0xf5de760f2e916647fd766B4AD9E85ff943cE3A2b'),
        name: 'MultiFaucet NFT',
        chainId,
        deployer: '0x59495589849423692778a8c5aaCA62CA80f875a4',
      })
      cB = await repositories.collection.save({
        contract: ethers.utils.getAddress('0xe0060010c2c81A817f4c52A9263d4Ce5c5B66D55'),
        name: 'tinyMusktweetz',
        chainId,
        deployer: '0x59495589849423692778a8c5aaCA62CA80f875a4',
      })

      await repositories.nft.save({
        contract: '0xf5de760f2e916647fd766B4AD9E85ff943cE3A2b',
        tokenId: '0x086a75',
        metadata: {
          name: 'chunks',
          description: 'NFT.com profile for chunks',
          traits: [],
        },
        type: defs.NFTType.ERC721,
        userId: testMockUser.id,
        walletId: testMockWallet.id,
        chainId,
      })

      await repositories.nft.save({
        contract: '0xe0060010c2c81A817f4c52A9263d4Ce5c5B66D55',
        tokenId: '0x01',
        metadata: {
          name: 'chunks',
          description: 'NFT.com profile for chunks',
          traits: [],
        },
        type: defs.NFTType.ERC721,
        userId: testMockUser.id,
        walletId: testMockWallet.id,
        chainId,
      })
    })
    afterAll(async () => {
      await clearDB(repositories)
    })

    it('should update collections image urls', async () => {
      const result = await testServer.executeOperation({
        query:
          'mutation UpdateCollectionImageUrls($count: Int!) { updateCollectionImageUrls(count: $count) { message } }',
        variables: {
          count: 1000,
        },
      })

      expect(result.data.updateCollectionImageUrls.message).toBeDefined()
      expect(result.data.updateCollectionImageUrls.message).toEqual('Updated 2 collections')
      const collectionA = await repositories.collection.findById(cA.id)
      expect(collectionA.bannerUrl).toBeDefined()
      expect(collectionA.logoUrl).toBeDefined()
      const collectionB = await repositories.collection.findById(cB.id)
      expect(collectionB.bannerUrl).toBeDefined()
      expect(collectionB.logoUrl).toBeDefined()
    })
  })

  describe('updateCollectionName', () => {
    beforeAll(async () => {
      testMockUser.chainId = '5'
      testMockWallet.chainId = '5'
      testMockWallet.chainName = 'goerli'

      testServer = getTestApolloServer(repositories, testMockUser, testMockWallet, { id: '5', name: 'goerli' })
      cA = await repositories.collection.save({
        contract: ethers.utils.getAddress('0xf5de760f2e916647fd766B4AD9E85ff943cE3A2b'),
        name: 'Unknown Name',
        chainId,
        deployer: '0x59495589849423692778a8c5aaCA62CA80f875a4',
      })
      cB = await repositories.collection.save({
        contract: ethers.utils.getAddress('0xe0060010c2c81A817f4c52A9263d4Ce5c5B66D55'),
        name: 'Unknown Name',
        chainId,
        deployer: '0x59495589849423692778a8c5aaCA62CA80f875a4',
      })

      await repositories.nft.save({
        contract: '0xf5de760f2e916647fd766B4AD9E85ff943cE3A2b',
        tokenId: '0x086a75',
        metadata: {
          name: 'chunks',
          description: 'NFT.com profile for chunks',
          traits: [],
        },
        type: defs.NFTType.ERC721,
        userId: testMockUser.id,
        walletId: testMockWallet.id,
        chainId,
      })

      await repositories.nft.save({
        contract: '0xe0060010c2c81A817f4c52A9263d4Ce5c5B66D55',
        tokenId: '0x01',
        metadata: {
          name: 'chunks',
          description: 'NFT.com profile for chunks',
          traits: [],
        },
        type: defs.NFTType.ERC721,
        userId: testMockUser.id,
        walletId: testMockWallet.id,
        chainId,
      })
    })
    afterAll(async () => {
      await clearDB(repositories)
    })

    it('should update collections names', async () => {
      const result = await testServer.executeOperation({
        query: 'mutation UpdateCollectionName($count: Int!) { updateCollectionName(count: $count) { message } }',
        variables: {
          count: 1000,
        },
      })

      expect(result.data.updateCollectionName.message).toBeDefined()
      expect(result.data.updateCollectionName.message).toEqual('Updated 2 collections')
      const collectionA = await repositories.collection.findById(cA.id)
      expect(collectionA.name).not.toEqual('Unknown Name')
      const collectionB = await repositories.collection.findById(cB.id)
      expect(collectionB.name).not.toEqual('Unknown Name')
    })
  })

  describe('updateSpamStatus', () => {
    beforeAll(async () => {
      testMockUser.chainId = '5'
      testMockWallet.chainId = '5'
      testMockWallet.chainName = 'goerli'

      const teamKey = process.env.TEAM_AUTH_TOKEN
      testServer = getTestApolloServer(repositories, testMockUser, testMockWallet, { id: '5', name: 'goerli' }, teamKey)

      await repositories.collection.save({
        contract: ethers.utils.getAddress('0x9Ef7A34dcCc32065802B1358129a226B228daB4E'),
        name: 'NFT.com Profile',
        chainId: '5',
      })
      await repositories.collection.save({
        contract: ethers.utils.getAddress('0xe0060010c2c81A817f4c52A9263d4Ce5c5B66D55'),
        name: 'NFT.com Genesis Key',
        chainId: '5',
      })

      profile = await repositories.profile.save({
        url: '1',
        ownerUserId: testMockUser.id,
        ownerWalletId: testMockWallet.id,
        tokenId: '2',
        status: defs.ProfileStatus.Owned,
        gkIconVisible: false,
        layoutType: defs.ProfileLayoutType.Default,
        chainId: '5',
      })

      const nftA = await repositories.nft.save({
        contract: '0x9Ef7A34dcCc32065802B1358129a226B228daB4E',
        tokenId: '0x03',
        metadata: {
          name: 'chunks',
          description: 'NFT.com profile for chunks',
          traits: [],
        },
        type: defs.NFTType.ERC721,
        userId: testMockUser.id,
        walletId: testMockWallet.id,
        chainId: '5',
      })
      const nftB = await repositories.nft.save({
        contract: '0xe0060010c2c81A817f4c52A9263d4Ce5c5B66D55',
        tokenId: '0x1359',
        metadata: {
          name: 'NFT.com Genesis Key #4953',
          description: '',
          traits: [],
        },
        type: defs.NFTType.ERC721,
        userId: testMockUser.id,
        walletId: testMockWallet.id,
        chainId: '5',
      })

      await repositories.edge.save({
        thatEntityId: nftA.id,
        thatEntityType: EntityType.NFT,
        thisEntityId: profile.id,
        thisEntityType: EntityType.Profile,
        edgeType: EdgeType.Displays,
        weight: 'aaaa',
        hide: false,
      })

      await repositories.edge.save({
        thatEntityId: nftB.id,
        thatEntityType: EntityType.NFT,
        thisEntityId: profile.id,
        thisEntityType: EntityType.Profile,
        edgeType: EdgeType.Displays,
        weight: 'aaab',
        hide: false,
      })
    })
    afterAll(async () => {
      await clearDB(repositories)
      await testServer.stop()
    })

    it('should update spam status', async () => {
      // check NFTs before setting spam collection
      let result = await testServer.executeOperation({
        query: 'query MyNFTs($input: NFTsInput) { myNFTs(input: $input) { items { id } } }',
        variables: {
          input: {
            profileId: profile.id,
            pageInput: {
              first: 100,
            },
          },
        },
      })

      expect(result.data.myNFTs).toBeDefined()
      expect(result.data.myNFTs.items.length).toEqual(2)
      result = await testServer.executeOperation({
        query:
          'mutation UpdateSpamStatus($contracts: [Address!]!, $isSpam: Boolean!) { updateSpamStatus(contracts: $contracts, isSpam: $isSpam) { message } }',
        variables: {
          contracts: ['0x9Ef7A34dcCc32065802B1358129a226B228daB4E'],
          isSpam: true,
        },
      })

      expect(result.data.updateSpamStatus.message).toBeDefined()
      expect(result.data.updateSpamStatus.message).toEqual('1 collections are set as spam')
      const collections = await repositories.collection.find({
        where: {
          isSpam: true,
          chainId: '5',
        },
      })
      expect(collections.length).toEqual(1)
      // check NFTs after setting spam collection
      result = await testServer.executeOperation({
        query: 'query MyNFTs($input: NFTsInput) { myNFTs(input: $input) { items { id } } }',
        variables: {
          input: {
            profileId: profile.id,
            pageInput: {
              first: 100,
            },
          },
        },
      })

      expect(result.data.myNFTs).toBeDefined()
      expect(result.data.myNFTs.items.length).toEqual(1)
    })
  })

  describe('numberOfNFTs', () => {
    beforeAll(async () => {
      testMockUser.chainId = '5'
      testMockWallet.chainId = '5'
      testMockWallet.chainName = 'goerli'

      testServer = getTestApolloServer(repositories, testMockUser, testMockWallet, { id: '5', name: 'goerli' })
      await repositories.collection.save({
        contract: ethers.utils.getAddress('0xe0060010c2c81A817f4c52A9263d4Ce5c5B66D55'),
        name: 'NFT.com Genesis Key',
        chainId: '5',
      })
      await repositories.nft.save({
        contract: '0xe0060010c2c81A817f4c52A9263d4Ce5c5B66D55',
        tokenId: '0x03',
        metadata: {
          name: 'chunks',
          description: 'NFT.com profile for #4952',
          traits: [],
        },
        type: defs.NFTType.ERC721,
        userId: testMockUser.id,
        walletId: testMockWallet.id,
        chainId: '5',
      })
      await repositories.nft.save({
        contract: '0xe0060010c2c81A817f4c52A9263d4Ce5c5B66D55',
        tokenId: '0x1359',
        metadata: {
          name: 'NFT.com Genesis Key #4953',
          description: '',
          traits: [],
        },
        type: defs.NFTType.ERC721,
        userId: testMockUser.id,
        walletId: testMockWallet.id,
        chainId: '5',
      })
    })

    afterAll(async () => {
      await clearDB(repositories)
      await testServer.stop()
    })
    it('should return number of NFTs in collections', async () => {
      const result = await testServer.executeOperation({
        query: `
        query NumberOfNFTs($contract: Address!, $chainId: String) {
          numberOfNFTs(contract: $contract, chainId: $chainId)
        }
        `,
        variables: {
          contract: '0xe0060010c2c81A817f4c52A9263d4Ce5c5B66D55',
          chainId: '5',
        },
      })

      expect(result.data.numberOfNFTs).toEqual(2)
    })
  })

  describe('updateOfficialCollections', () => {
    beforeAll(async () => {
      testMockUser.chainId = '5'
      testMockWallet.chainId = '5'
      testMockWallet.chainName = 'goerli'

      testServer = getTestApolloServer(repositories, testMockUser, testMockWallet, { id: '5', name: 'goerli' })
      await repositories.collection.save({
        contract: ethers.utils.getAddress('0xe0060010c2c81A817f4c52A9263d4Ce5c5B66D55'),
        name: 'NFT.com Genesis Key',
        chainId: '5',
      })
      await repositories.collection.save({
        contract: ethers.utils.getAddress('0x9Ef7A34dcCc32065802B1358129a226B228daB4E'),
        name: 'NFT.com Genesis Key',
        chainId: '5',
      })
    })

    afterAll(async () => {
      await clearDB(repositories)
      await testServer.stop()
    })
    it('should update collections as official', async () => {
      const filename = 'test_collections.csv'
      const file = fs.createReadStream(join(__dirname, '..', 'resource', filename))
      // const file = Readable.from(Buffer.from('hello upload', 'utf-8'))
      const upload = new Upload()
      upload.promise = new Promise(resolve =>
        resolve({
          createReadStream: () => file,
          filename: filename,
          mimetype: 'text/plain',
        }),
      )
      const result = await testServer.executeOperation({
        query: `
        mutation UpdateOfficialCollections($list: Upload!) {
          updateOfficialCollections(list: $list) {
            message
          }
        }
        `,
        variables: {
          list: upload,
        },
      })

      expect(result.data.updateOfficialCollections.message).toEqual('2 collections are updated as official')
    })
  })
})
