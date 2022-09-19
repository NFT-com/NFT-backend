import { ethers } from 'ethers'
import { Connection } from 'typeorm'

import { testDBConfig } from '@nftcom/gql/config'
import { delay } from '@nftcom/gql/service/core.service'
import * as nftService from '@nftcom/gql/service/nft.service'
import { defs, typechain } from '@nftcom/shared/'
import { db } from '@nftcom/shared/db'
import { EdgeType, EntityType } from '@nftcom/shared/defs'

import {
  nftTestMockData,
  testMockProfiles,
  testMockUser,
  testMockWallet,
} from '../util/constants'
import { clearDB } from '../util/helpers'
import { getTestApolloServer } from '../util/testApolloServer'

jest.setTimeout(300000)
jest.retryTimes(2)

jest.mock('@nftcom/gql/service/searchEngine.service', () => {
  return {
    SearchEngineService: jest.fn().mockImplementation(() => {
      return {
        indexCollections: jest.fn().mockResolvedValue(true),
        indexNFTs: jest.fn().mockResolvedValue(true),
        deleteNFT: jest.fn().mockResolvedValue(true),
      }
    }),
  }
})

jest.mock('@nftcom/gql/service/cache.service', () => ({
  cache: {
    get: jest.fn(),
    set: jest.fn(),
  },
  CacheKeys: {
    ASSOCIATED_ADDRESSES: 'associated_addresses',
    UPDATE_NFT_FOR_ASSOCIATED_WALLET: 'update_nft_for_associated_wallet',
  },
  createCacheConnection: jest.fn(),
}))

let testServer
const repositories = db.newRepositories()
let connection: Connection
let profile
let nft

const env = Object.assign({}, process.env)

const mockTestServer = (): any => {
  const mockArgs ={
    contract: nftTestMockData.contract,
    tokenId: nftTestMockData.tokenId,
    chainId: nftTestMockData.chainId,
  }
  testServer = getTestApolloServer({
    nft: {
      findById: (id) => {
        if (id === nftTestMockData.id) {
          return Promise.resolve({
            id,
            contract: mockArgs.contract,
            tokenId: mockArgs.tokenId,
            profileId: testMockProfiles.id,
          })
        }
        return null
      },
      findOne: ({ where: mockArgs }) => Promise.resolve({
        contract: mockArgs.contract,
        tokenId: mockArgs.tokenId,
        chainId: mockArgs.chainId,
      }),
    },
    profile: {
      findById: (id) => {
        if (id === testMockProfiles.id) {
          return Promise.resolve({
            id,
            url: testMockProfiles.url,
          })
        }
        return null
      },
    },
  },
  )
}

describe('nft resolver', () => {
  beforeAll(async () => {
    connection = await db.connectTestDB(testDBConfig)
  })

  afterAll(async () => {
    if (!connection) return
    await connection.close()
  })

  describe('get NFT', () => {
    beforeAll(async () => {
      testMockUser.chainId = '5'
      testMockWallet.chainId = '5'
      testMockWallet.chainName = 'goerli'
      testServer = getTestApolloServer(repositories,
        testMockUser,
        testMockWallet,
        { id: '5', name: 'goerli' },
      )

      await repositories.nft.save({
        contract: '0xf5de760f2e916647fd766B4AD9E85ff943cE3A2b',
        tokenId: '0x0d5415',
        chainId: '5',
        metadata: {
          name: '',
          description: '',
          traits: [],
        },
        type: defs.NFTType.ERC721,
        userId: testMockUser.id,
        walletId: testMockWallet.id,
      })
    })

    afterAll(async () => {
      await clearDB(repositories)
      await testServer.stop()
    })

    it('should throw error since this NFT is not existing', async () => {
      const result = await testServer.executeOperation({
        query: `query Nft($contract: Address!, $nftId: String!, $chainId: String!) {
                nft(contract: $contract, id: $nftId, chainId: $chainId) {
                  tokenId
                  contract
                  chainId
                }
              }`,
        variables: {
          contract: '0x657732980685C29A51053894542D7cb97de144Fe',
          nftId: '0x07',
          chainId: '5',
        },
      })

      expect(result.errors.length).toEqual(1)
      expect(result.errors[0].errorKey).toEqual('NFT_NOT_VALID')
    })

    it('should save new NFT in our DB', async () => {
      const result = await testServer.executeOperation({
        query: `query Nft($contract: Address!, $nftId: String!, $chainId: String!) {
                nft(contract: $contract, id: $nftId, chainId: $chainId) {
                  tokenId
                  contract
                  chainId
                }
              }`,
        variables: {
          contract: '0xe0060010c2c81A817f4c52A9263d4Ce5c5B66D55',
          nftId: '0x0226',
          chainId: '5',
        },
      })

      expect(result.data.nft).toBeDefined()
      const nft = await repositories.nft.findOne({
        where: {
          contract: '0xe0060010c2c81A817f4c52A9263d4Ce5c5B66D55',
          tokenId: '0x0226',
          chainId: '5',
        },
      })
      expect(nft).toBeDefined()
      const collection = await repositories.collection.findOne({
        where: {
          contract: '0xe0060010c2c81A817f4c52A9263d4Ce5c5B66D55',
          chainId: '5',
        },
      })
      expect(collection).toBeDefined()
      const edge = await repositories.edge.findOne({
        where: {
          thisEntityId: collection.id,
          thisEntityType: defs.EntityType.Collection,
          thatEntityId: nft.id,
          thatEntityType: defs.EntityType.NFT,
          edgeType: defs.EdgeType.Includes,
        },
      })
      expect(edge).toBeDefined()
    })

    it('should not update NFT twice in NFT_REFRESH_DURATION period ', async () => {
      await testServer.executeOperation({
        query: `query Nft($contract: Address!, $nftId: String!, $chainId: String!) {
                nft(contract: $contract, id: $nftId, chainId: $chainId) {
                  tokenId
                  contract
                  chainId
                }
              }`,
        variables: {
          contract: '0xf5de760f2e916647fd766B4AD9E85ff943cE3A2b',
          nftId: '0x0d5415',
          chainId: '5',
        },
      })

      await delay(10000)
      let nft = await repositories.nft.findOne({
        where: {
          contract: '0xf5de760f2e916647fd766B4AD9E85ff943cE3A2b',
          tokenId: '0x0d5415',
          chainId: '5',
        },
      })
      expect(nft.userId).not.toEqual('test-user-id')
      expect(nft.walletId).not.toEqual('test-wallet-id')
      expect(nft.lastRefreshed).toBeDefined()
      const lastUpdated = nft.lastRefreshed
      await testServer.executeOperation({
        query: `query Nft($contract: Address!, $nftId: String!, $chainId: String!) {
                nft(contract: $contract, id: $nftId, chainId: $chainId) {
                  tokenId
                  contract
                  chainId
                }
              }`,
        variables: {
          contract: '0xf5de760f2e916647fd766B4AD9E85ff943cE3A2b',
          nftId: '0x0d5415',
          chainId: '5',
        },
      })
      nft = await repositories.nft.findOne({
        where: {
          contract: '0xf5de760f2e916647fd766B4AD9E85ff943cE3A2b',
          tokenId: '0x0d5415',
          chainId: '5',
        },
      })
      expect(nft.lastRefreshed).toEqual(lastUpdated)
    })
  })

  describe('get NFT By Id', () => {
    beforeAll(async () => {
      mockTestServer()
    })

    afterAll(async () => {
      jest.clearAllMocks()
      await testServer.stop()
    })

    // get NFT By Id
    it('should get NFT By Id', async () => {
      const result = await testServer.executeOperation({
        query: `query NftById($nftByIdId: ID!) {
          nftById(id: $nftByIdId) {
            id
            preferredProfile {
              url
            }
          }
        }`,
        variables: {
          nftByIdId: nftTestMockData.id,
        },
      })
      expect(result?.data?.nftById?.id).toBe(nftTestMockData.id)
      expect(result.data.nftById.preferredProfile.url).toBe(testMockProfiles.url)
    })

    // error
    it('should throw an error', async () => {
      const result = await testServer.executeOperation({
        query: `query NftById($nftByIdId: ID!) {
          nftById(id: $nftByIdId) {
            id
          }
        }`,
        variables: {
          nftByIdId: 'abcd',
        },
      })
      expect(result?.errors).toHaveLength(1)
    })
  })

  describe('updateAssociatedAddresses', () => {
    beforeAll(async () => {
      testMockUser.chainId = '5'
      testMockWallet.chainId = '5'
      testMockWallet.chainName = 'goerli'

      testServer = getTestApolloServer(repositories,
        testMockUser,
        testMockWallet,
        { id: '5', name: 'goerli' },
      )

      const wallet = await repositories.wallet.save({
        userId: 'test-user-id',
        chainId: '5',
        chainName: 'goerli',
        network: 'ethereum',
        address: '0x59495589849423692778a8c5aaCA62CA80f875a4',
      })

      profile = await repositories.profile.save({
        url: 'gk',
        ownerUserId: 'test-user-id',
        ownerWalletId: wallet.id,
        tokenId: '0',
        status: defs.ProfileStatus.Owned,
        gkIconVisible: false,
        layoutType: defs.ProfileLayoutType.Default,
        chainId: '5',
      })
    })

    afterAll(async () => {
      await clearDB(repositories)
      await testServer.stop()
    })

    it('should refresh NFTs for associated addresses', async () => {
      const result = await testServer.executeOperation({
        query: 'mutation UpdateAssociatedAddresses($input: UpdateAssociatedAddressesInput) { updateAssociatedAddresses(input: $input) { message } }',
        variables: {
          input: {
            profileUrl: 'gk',
            chainId: '5',
          },
        },
      })

      expect(result.data.updateAssociatedAddresses.message).toBeDefined()
      expect(result.data.updateAssociatedAddresses.message).toEqual('refreshed NFTs for associated addresses of gk')
      const nftEdges = await repositories.edge.find({
        where: {
          thisEntityType: defs.EntityType.Profile,
          thisEntityId: profile.id,
          thatEntityType: defs.EntityType.NFT,
          edgeType: defs.EdgeType.Displays,
        },
      })
      expect(nftEdges.length).toBeGreaterThan(0)
      const collectionEdges = await repositories.edge.find({
        where: {
          thisEntityType: defs.EntityType.Collection,
          edgeType: defs.EdgeType.Includes,
        },
      })
      expect(collectionEdges.length).toBeGreaterThan(0)
      const nfts = await repositories.nft.findAll()
      expect(nfts.length).toBeGreaterThan(0)
    })
  })

  describe.skip('updateAssociatedContract', () => {
    beforeAll(async () => {
      testMockUser.chainId = '5'
      testMockWallet.chainId = '5'
      testMockWallet.chainName = 'goerli'

      testServer = getTestApolloServer(repositories,
        testMockUser,
        testMockWallet,
        { id: '5', name: 'goerli' },
      )

      const wallet = await repositories.wallet.save({
        userId: 'test-user-id',
        chainId: '5',
        chainName: 'goerli',
        network: 'ethereum',
        address: '0x1958Af77c06faB96D63351cACf10ABd3f598873B',
      })

      profile = await repositories.profile.save({
        url: '1',
        ownerUserId: 'test-user-id',
        ownerWalletId: wallet.id,
        tokenId: '0',
        status: defs.ProfileStatus.Owned,
        gkIconVisible: false,
        layoutType: defs.ProfileLayoutType.Default,
        chainId: '5',
      })
    })

    afterAll(async () => {
      await clearDB(repositories)
      await testServer.stop()
    })

    it('should update associated contract', async () => {
      const result = await testServer.executeOperation({
        query: 'mutation UpdateAssociatedContract($input: UpdateAssociatedContractInput) { updateAssociatedContract(input: $input) { message } }',
        variables: {
          input: {
            profileUrl: '1',
            chainId: '5',
          },
        },
      })

      expect(result.data.updateAssociatedContract.message).toEqual('Updated associated contract for 1')
      const collections = await repositories.collection.findAll()
      expect(collections.length).toBeGreaterThan(0)
    })
  })

  describe('updateNFTMemo', () => {
    beforeAll(async () => {
      testMockUser.chainId = '5'
      testMockWallet.chainId = '5'
      testMockWallet.chainName = 'goerli'

      testServer = getTestApolloServer(repositories,
        testMockUser,
        testMockWallet,
        { id: '5', name: 'goerli' },
      )

      nft = await repositories.nft.save({
        contract: '0xe0060010c2c81A817f4c52A9263d4Ce5c5B66D55',
        tokenId: '0x09c5',
        metadata: {
          name: '',
          description: '',
          traits: [],
        },
        type: defs.NFTType.ERC721,
        userId: 'test-user-id',
        walletId: 'test-wallet-id',
        chainId: '5',
      })
    })

    afterAll(async () => {
      await clearDB(repositories)
      await testServer.stop()
    })

    it('should update memo', async () => {
      const result = await testServer.executeOperation({
        query: 'mutation UpdateNFTMemo($nftId: ID!, $memo: String!) { updateNFTMemo(nftId: $nftId, memo: $memo) { memo } }',
        variables: {
          nftId: nft.id,
          memo: 'This is test memo',
        },
      })

      expect(result.data.updateNFTMemo.memo).toBeDefined()
      expect(result.data.updateNFTMemo.memo).toEqual('This is test memo')
    })
  })

  describe('myNFTs', () => {
    let profileA, profileB
    let nftA, nftB, nftC, nftD

    beforeAll(async () => {
      testMockUser.chainId = '5'
      testMockWallet.chainId = '5'
      testMockWallet.chainName = 'goerli'

      testServer = getTestApolloServer(repositories,
        testMockUser,
        testMockWallet,
        { id: '5', name: 'goerli' },
      )

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
      await repositories.collection.save({
        contract: ethers.utils.getAddress('0xf5de760f2e916647fd766B4AD9E85ff943cE3A2b'),
        name: 'NFT.com Profile',
        chainId: '5',
      })
      await repositories.collection.save({
        contract: ethers.utils.getAddress('0x657732980685C29A51053894542D7cb97de144Fe'),
        name: 'NFT.com Genesis Key',
        chainId: '5',
      })

      profileA = await repositories.profile.save({
        url: 'test-profile-url',
        ownerUserId: 'test-user-id',
        ownerWalletId: 'test-wallet-id',
      })
      profileB = await repositories.profile.save({
        url: 'test-profile-url-1',
        ownerUserId: 'test-user-id-1',
        ownerWalletId: 'test-wallet-id-1',
      })
      nftA = await repositories.nft.save({
        contract: '0xe0060010c2c81A817f4c52A9263d4Ce5c5B66D55',
        tokenId: '0x09c5',
        metadata: {
          name: '',
          description: '',
          traits: [],
        },
        type: defs.NFTType.ERC721,
        userId: 'test-user-id',
        walletId: 'test-wallet-id',
        chainId: '5',
      })
      nftB = await repositories.nft.save({
        contract: '0x9Ef7A34dcCc32065802B1358129a226B228daB4E',
        tokenId: '0x01',
        metadata: {
          name: '',
          description: '',
          traits: [],
        },
        type: defs.NFTType.ERC721,
        userId: 'test-user-id',
        walletId: 'test-wallet-id',
        chainId: '5',
      })
      nftC = await repositories.nft.save({
        contract: '0xf5de760f2e916647fd766B4AD9E85ff943cE3A2b',
        tokenId: '0x0927b2',
        metadata: {
          name: '',
          description: '',
          traits: [],
        },
        type: defs.NFTType.ERC721,
        userId: 'test-user-id-1',
        walletId: 'test-wallet-id-1',
        chainId: '5',
      })
      nftD = await repositories.nft.save({
        contract: '0x657732980685C29A51053894542D7cb97de144Fe',
        tokenId: '0x0d',
        metadata: {
          name: '',
          description: '',
          traits: [],
        },
        type: defs.NFTType.ERC721,
        userId: 'test-user-id-1',
        walletId: 'test-wallet-id-1',
        chainId: '5',
      })
      await repositories.edge.save({
        thisEntityId: profileA.id,
        thisEntityType: defs.EntityType.Profile,
        thatEntityId: nftA.id,
        thatEntityType: defs.EntityType.NFT,
        edgeType: defs.EdgeType.Displays,
        weight: 'aaaa',
        hide: false,
      })
      await repositories.edge.save({
        thisEntityId: profileA.id,
        thisEntityType: defs.EntityType.Profile,
        thatEntityId: nftB.id,
        thatEntityType: defs.EntityType.NFT,
        edgeType: defs.EdgeType.Displays,
        weight: 'aaab',
        hide: true,
      })
      await repositories.edge.save({
        thisEntityId: profileB.id,
        thisEntityType: defs.EntityType.Profile,
        thatEntityId: nftC.id,
        thatEntityType: defs.EntityType.NFT,
        edgeType: defs.EdgeType.Displays,
        weight: 'aaaa',
        hide: false,
      })
      await repositories.edge.save({
        thisEntityId: profileB.id,
        thisEntityType: defs.EntityType.Profile,
        thatEntityId: nftD.id,
        thatEntityType: defs.EntityType.NFT,
        edgeType: defs.EdgeType.Displays,
        weight: 'aaab',
        hide: true,
      })
    })

    afterAll(async () => {
      await clearDB(repositories)
      await testServer.stop()
    })

    it('should return NFTs of profile owned by user', async () => {
      const result = await testServer.executeOperation({
        query: 'query MyNFTs($input: NFTsInput) { myNFTs(input: $input) { items { id } } }',
        variables: {
          input: {
            filter: true,
            profileId: profileA.id,
            pageInput: {
              first: 100,
            },
          },
        },
      })

      expect(result.data.myNFTs).toBeDefined()
      expect(result.data.myNFTs.items.length).toEqual(2)
    })

    it('should return NFTs of profile not owned by wallet', async () => {
      const result = await testServer.executeOperation({
        query: 'query MyNFTs($input: NFTsInput) { myNFTs(input: $input) { items { id } } }',
        variables: {
          input: {
            profileId: profileB.id,
            pageInput: {
              first: 100,
            },
          },
        },
      })

      expect(result.data.myNFTs).toBeDefined()
      expect(result.data.myNFTs.items.length).toEqual(2)
    })

    it('should return owned NFTs by wallet with only filter', async () => {
      const result = await testServer.executeOperation({
        query: 'query MyNFTs($input: NFTsInput) { myNFTs(input: $input) { items { id } } }',
        variables: {
          input: {
            filter: true,
            pageInput: {
              first: 1000,
            },
          },
        },
      })

      expect(result.data.myNFTs).toBeDefined()
      expect(result.data.myNFTs.items.length).toEqual(2)
    })

    it('should return owned NFTs by wallet without filter and profileId', async () => {
      const result = await testServer.executeOperation({
        query: 'query MyNFTs($input: NFTsInput) { myNFTs(input: $input) { items { id } } }',
        variables: {
          input: {
            pageInput: {
              first: 1000,
            },
          },
        },
      })

      expect(result.data.myNFTs).toBeDefined()
      expect(result.data.myNFTs.items.length).toEqual(2)
    })
  })

  describe('nftsForCollections', () => {
    let profileA

    beforeAll(async () => {
      testMockUser.chainId = '5'
      testMockWallet.chainId = '5'
      testMockWallet.chainName = 'goerli'

      testServer = getTestApolloServer(repositories,
        testMockUser,
        testMockWallet,
        { id: '5', name: 'goerli' },
      )

      const collection = await repositories.collection.save({
        contract: '0xe0060010c2c81A817f4c52A9263d4Ce5c5B66D55',
        name: 'NFT.com Genesis Key',
        chainId: '5',
      })

      profileA = await repositories.profile.save({
        url: 'test-profile',
      })

      const nftA = await repositories.nft.save({
        contract: '0xe0060010c2c81A817f4c52A9263d4Ce5c5B66D55',
        tokenId: '0x09c5',
        metadata: {
          name: '',
          description: '',
          traits: [],
        },
        type: defs.NFTType.ERC721,
        userId: 'test-user-id',
        walletId: 'test-wallet-id',
        chainId: '5',
        profileId: profileA.id,
      })

      await repositories.edge.save({
        thisEntityId: collection.id,
        thisEntityType: defs.EntityType.Collection,
        thatEntityId: nftA.id,
        thatEntityType: defs.EntityType.NFT,
        edgeType: defs.EdgeType.Includes,
      })
    })

    afterAll(async () => {
      await clearDB(repositories)
      await testServer.stop()
    })

    it('should return nfts for collections', async () => {
      const result = await testServer.executeOperation({
        query: 'query NftsForCollections($input: NftsForCollectionsInput!) { nftsForCollections(input: $input) { collectionAddress actualNumberOfNFTs nfts { id contract profileId preferredProfile { url } } } }',
        variables: {
          input: {
            collectionAddresses: ['0xe0060010c2c81A817f4c52A9263d4Ce5c5B66D55'],
            count: 10,
            chainId: '5',
          },
        },
      })

      expect(result.data.nftsForCollections).toBeDefined()
      expect(result.data.nftsForCollections.length).toEqual(1)
      expect(result.data.nftsForCollections[0].actualNumberOfNFTs).toEqual(1)
      expect(result.data.nftsForCollections[0].collectionAddress).toEqual('0xe0060010c2c81A817f4c52A9263d4Ce5c5B66D55')
      expect(result.data.nftsForCollections[0].nfts.length).toBeGreaterThan(0)
      expect(result.data.nftsForCollections[0].nfts[0].profileId).toBe(profileA.id)
      expect(result.data.nftsForCollections[0].nfts[0].preferredProfile.url).toBe('test-profile')
    })

    it('should return less than 100 nfts for collections', async () => {
      const result = await testServer.executeOperation({
        query: 'query NftsForCollections($input: NftsForCollectionsInput!) { nftsForCollections(input: $input) { collectionAddress actualNumberOfNFTs nfts { id contract profileId preferredProfile { url } } } }',
        variables: {
          input: {
            collectionAddresses: ['0xe0060010c2c81A817f4c52A9263d4Ce5c5B66D55'],
            count: 1000,
            chainId: '5',
          },
        },
      })

      expect(result.data.nftsForCollections).toBeDefined()
      expect(result.data.nftsForCollections.length).toEqual(1)
      expect(result.data.nftsForCollections[0].nfts.length).toBeLessThanOrEqual(100)
    })
  })

  describe('collectionNFTs', () => {
    beforeAll(async () => {
      testMockUser.chainId = '5'
      testMockWallet.chainId = '5'
      testMockWallet.chainName = 'goerli'

      testServer = getTestApolloServer(repositories,
        testMockUser,
        testMockWallet,
        { id: '5', name: 'goerli' },
      )

      const collection = await repositories.collection.save({
        contract: '0xe0060010c2c81A817f4c52A9263d4Ce5c5B66D55',
        name: 'NFT.com Genesis Key',
        chainId: '5',
      })

      const nftA = await repositories.nft.save({
        contract: '0xe0060010c2c81A817f4c52A9263d4Ce5c5B66D55',
        tokenId: '0x09c5',
        metadata: {
          name: '',
          description: '',
          traits: [],
        },
        type: defs.NFTType.ERC721,
        userId: 'test-user-id',
        walletId: 'test-wallet-id',
        chainId: '5',
      })

      await repositories.edge.save({
        thisEntityId: collection.id,
        thisEntityType: defs.EntityType.Collection,
        thatEntityId: nftA.id,
        thatEntityType: defs.EntityType.NFT,
        edgeType: defs.EdgeType.Includes,
      })
    })

    afterAll(async () => {
      await clearDB(repositories)
      await testServer.stop()
    })

    it('should return less than 100 nfts of collection', async () => {
      const result = await testServer.executeOperation({
        query: 'query CollectionNFTs($input: CollectionNFTsInput!) { collectionNFTs(input: $input) { items { id contract } totalItems } }',
        variables: {
          input: {
            collectionAddress: '0xe0060010c2c81A817f4c52A9263d4Ce5c5B66D55',
            pageInput: { first: 100 },
            chainId: '5',
          },
        },
      })

      expect(result.data.collectionNFTs).toBeDefined()
      expect(result.data.collectionNFTs.items.length).toBeLessThanOrEqual(100)
      expect(result.data.collectionNFTs.totalItems).toBeLessThanOrEqual(100)
    })
  })

  describe('updateNFTProfileId', () => {
    let profileA
    let nftA
    beforeAll(async () => {
      testServer = getTestApolloServer(repositories,
        testMockUser,
        testMockWallet,
        { id: '5', name: 'goerli' },
      )
    })

    beforeEach(async () => {
      testMockUser.chainId = '5'
      testMockWallet.chainId = '5'
      testMockWallet.chainName = 'goerli'

      profileA = await repositories.profile.save({
        url: 'test-profile',
        ownerWalletId: testMockWallet.id,
      })

      nftA = await repositories.nft.save({
        contract: '0xe0060010c2c81A817f4c52A9263d4Ce5c5B66D55',
        tokenId: '0x09c5',
        metadata: {
          name: '',
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
      await testServer.stop()
    })

    afterEach(async () => {
      await clearDB(repositories)
    })
    it('should insert the profile ID of a profile owned by the user', async () => {
      const result = await testServer.executeOperation({
        query: 'mutation UpdateNFTProfileId($nftId: ID!, $profileId: ID!) { updateNFTProfileId(nftId: $nftId, profileId: $profileId) { profileId } }',
        variables: {
          nftId: nftA.id,
          profileId: profileA.id,
        },
      })

      expect(result.data.updateNFTProfileId.profileId).toBe(profileA.id)
    })

    it('should not update profile ID if NFT not owned by the user', async () => {
      await repositories.nft.updateOneById(nftA.id, {
        walletId: 'something-else',
      })

      const result = await testServer.executeOperation({
        query: 'mutation UpdateNFTProfileId($nftId: ID!, $profileId: ID!) { updateNFTProfileId(nftId: $nftId, profileId: $profileId) { profileId } }',
        variables: {
          nftId: nftA.id,
          profileId: profileA.id,
        },
      })

      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].statusCode).toBe('403')
      expect(result.errors[0].message).toBe('NFT not owned by user')
    })

    it('should not update profile ID if profile not owned by the user', async () => {
      await repositories.profile.updateOneById(profileA.id, {
        ownerWalletId: 'something-different',
      })

      const result = await testServer.executeOperation({
        query: 'mutation UpdateNFTProfileId($nftId: ID!, $profileId: ID!) { updateNFTProfileId(nftId: $nftId, profileId: $profileId) { profileId } }',
        variables: {
          nftId: nftA.id,
          profileId: profileA.id,
        },
      })

      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].statusCode).toBe('403')
      expect(result.errors[0].message).toBe(`You cannot update profile ${profileA.id} because you do not own it`)
    })

    it('should return an error if NFT is not found', async () => {
      const result = await testServer.executeOperation({
        query: 'mutation UpdateNFTProfileId($nftId: ID!, $profileId: ID!) { updateNFTProfileId(nftId: $nftId, profileId: $profileId) { profileId } }',
        variables: {
          nftId: 'not-an-nft-id',
          profileId: profileA.id,
        },
      })

      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].statusCode).toBe('404')
      expect(result.errors[0].message).toBe('NFT not-an-nft-id not found')
    })

    it('should return an error if profile is not found', async () => {
      const result = await testServer.executeOperation({
        query: 'mutation UpdateNFTProfileId($nftId: ID!, $profileId: ID!) { updateNFTProfileId(nftId: $nftId, profileId: $profileId) { profileId } }',
        variables: {
          nftId: nftA.id,
          profileId: 'not-a-profile-id',
        },
      })

      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].statusCode).toBe('404')
      expect(result.errors[0].message).toBe('Profile not-a-profile-id not found')
    })
  })

  describe('updateNFTsForProfile', () => {
    let profileA
    let nftA
    beforeAll(async () => {
      testServer = getTestApolloServer(repositories,
        testMockUser,
        testMockWallet,
        { id: '5', name: 'goerli' },
      )
    })

    beforeEach(async () => {
      testMockUser.chainId = '5'
      testMockWallet.chainId = '5'
      testMockWallet.chainName = 'goerli'

      profileA = await repositories.profile.save({
        url: 'test-profile',
        ownerUserId: testMockUser.id,
        ownerWalletId: testMockWallet.id,
        chainId: '5',
      })

      nftA = await repositories.nft.save({
        contract: nftTestMockData.contract,
        tokenId: nftTestMockData.tokenId,
        chainId: '5',
        metadata: {
          name: '',
          description: '',
          traits: [],
        },
        type: defs.NFTType.ERC721,
        userId: testMockUser.id,
        walletId: testMockWallet.id,
      })
    })

    afterAll(async () => {
      await testServer.stop()
    })

    afterEach(async () => {
      await clearDB(repositories)
    })

    it('should reset profile ID if NFT not owned by the user', async () => {
      await repositories.wallet.save({
        ...testMockWallet,
        userId: testMockUser.id,
        createdAt: undefined,
      })
      await repositories.edge.save({
        thatEntityId: nftA.id,
        thatEntityType: EntityType.NFT,
        thisEntityId: profileA.id,
        thisEntityType: EntityType.Profile,
        edgeType: EdgeType.Displays,
      })

      const alchemySpy = jest.spyOn(nftService, 'getNFTsFromAlchemy')
      alchemySpy.mockResolvedValue([])
      typechain.NftResolver__factory.connect = jest.fn().mockReturnValue({
        associatedAddresses: jest.fn().mockResolvedValue([]),
      })

      const result = await testServer.executeOperation({
        query: 'mutation UpdateNFTsForProfile($input: UpdateNFTsForProfileInput) { updateNFTsForProfile(input: $input) { items { profileId } } }',
        variables: {
          input: {
            profileId: profileA.id,
            chainId: profileA.chainId,
            pageInput: {
              first: 1,
            },
          },
        },
      })

      // This expectation sucks, but jest spies for repository.edge.hardDelete
      // and repository.nft.hardDelete are being evaluated before the code is
      // reached. It's likely because of how the promises are structured...
      expect(result.data.updateNFTsForProfile.items).toHaveLength(0)
    })
  })

  describe('uploadMetadataImagesToS3', () => {
    beforeEach(async () => {
      testMockUser.chainId = '5'
      testMockWallet.chainId = '5'
      testMockWallet.chainName = 'goerli'

      testServer = getTestApolloServer(repositories,
        testMockUser,
        testMockWallet,
        { id: '5', name: 'goerli' },
      )

      await repositories.nft.save({
        contract: '0xe0060010c2c81A817f4c52A9263d4Ce5c5B66D55',
        tokenId: '0x0390',
        chainId: '5',
        metadata: {
          name: '',
          description: '',
          imageURL: 'ipfs://QmNivD575CW7sxP5wJJiw1jbDdQTScuCcwxnjwKLEZTSqo',
          traits: [],
        },
        type: defs.NFTType.ERC721,
        userId: testMockUser.id,
        walletId: testMockWallet.id,
      })

      await repositories.nft.save({
        contract: '0xe0060010c2c81A817f4c52A9263d4Ce5c5B66D55',
        tokenId: '0x01cf',
        chainId: '5',
        metadata: {
          name: '',
          description: '',
          imageURL: 'ipfs://Qmf4gLHJkjEmfzQyhxDpeQZeeEZdfAdh8FAEtdcLxAu3bi',
          traits: [],
        },
        type: defs.NFTType.ERC721,
        userId: testMockUser.id,
        walletId: testMockWallet.id,
      })
    })

    afterEach(async () => {
      await clearDB(repositories)
      await testServer.stop()
      process.env = env
    })

    it('should update previewLink of NFTs', async () => {
      const result = await testServer.executeOperation({
        query: 'mutation UploadMetadataImagesToS3($count: Int!) { uploadMetadataImagesToS3(count:$count) {  message } }',
        variables: {
          count: 100,
        },
      })

      expect(result.data.uploadMetadataImagesToS3.message).toEqual('Saved preview link of metadata image for 2 NFTs')
      const nfts = await repositories.nft.findAll()
      expect(nfts.length).toEqual(2)
      for (nft of nfts) {
        expect(nft.previewLink).not.toBeNull()
      }
    })

    it('should update previewLink of NFTs when there is no IPFS gateway defined', async () => {
      process.env.IPFS_WEB_GATEWAY = ''
      const result = await testServer.executeOperation({
        query: 'mutation UploadMetadataImagesToS3($count: Int!) { uploadMetadataImagesToS3(count:$count) {  message } }',
        variables: {
          count: 100,
        },
      })

      expect(result.data.uploadMetadataImagesToS3.message).toEqual('Saved preview link of metadata image for 2 NFTs')
      const nfts = await repositories.nft.findAll()
      expect(nfts.length).toEqual(2)
      for (nft of nfts) {
        expect(nft.previewLink).not.toBeNull()
      }
    })

    it('should update previewLink of NFTs when there is one IPFS gateway defined', async () => {
      process.env.IPFS_WEB_GATEWAY = 'https://ipns.co/ipfs/'
      const result = await testServer.executeOperation({
        query: 'mutation UploadMetadataImagesToS3($count: Int!) { uploadMetadataImagesToS3(count:$count) {  message } }',
        variables: {
          count: 100,
        },
      })

      expect(result.data.uploadMetadataImagesToS3.message).toEqual('Saved preview link of metadata image for 2 NFTs')
      const nfts = await repositories.nft.findAll()
      expect(nfts.length).toEqual(2)
      for (nft of nfts) {
        expect(nft.previewLink).not.toBeNull()
      }
    })

    it('should update previewLink of NFTs when there are multiple IPFS gateways defined', async () => {
      process.env.IPFS_WEB_GATEWAY = 'https://ipns.co/ipfs/,https://dweb.link/ipfs/,https://cf-ipfs.com/ipfs/'
      const result = await testServer.executeOperation({
        query: 'mutation UploadMetadataImagesToS3($count: Int!) { uploadMetadataImagesToS3(count:$count) {  message } }',
        variables: {
          count: 100,
        },
      })

      expect(result.data.uploadMetadataImagesToS3.message).toEqual('Saved preview link of metadata image for 2 NFTs')
      const nfts = await repositories.nft.findAll()
      expect(nfts.length).toEqual(2)
      for (nft of nfts) {
        expect(nft.previewLink).not.toBeNull()
      }
    })
  })

  describe('updateENSNFTMetadata', () => {
    beforeAll(async () => {
      testMockUser.chainId = '5'
      testMockWallet.chainId = '5'
      testMockWallet.chainName = 'goerli'
      testServer = getTestApolloServer(repositories,
        testMockUser,
        testMockWallet,
        { id: '5', name: 'goerli' },
      )

      await repositories.nft.save({
        contract: '0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85',
        tokenId: '0x3f183afce162dcff1453495c6932401729f4cc3832aa5807293967ee9efa53db',
        chainId: '4',
        metadata: {
          name: '',
          description: '',
          traits: [],
        },
        type: defs.NFTType.UNKNOWN,
        userId: testMockUser.id,
        walletId: testMockWallet.id,
      })
    })

    afterAll(async () => {
      await clearDB(repositories)
      await testServer.stop()
    })

    it('should not update any ENS NFTs', async () => {
      const result = await testServer.executeOperation({
        query: 'mutation UpdateENSNFTMetadata($count: Int!) { updateENSNFTMetadata(count:$count) {  message } }',
        variables: {
          count: 100,
        },
      })

      expect(result.data.updateENSNFTMetadata.message).toEqual('Updated image urls of metadata for 0 ENS NFTs')
    })
  })
})
