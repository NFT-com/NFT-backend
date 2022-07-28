import { Connection } from 'typeorm'

import { testDBConfig } from '@nftcom/gql/config'
import { defs } from '@nftcom/shared/'
import { db } from '@nftcom/shared/db'

import {
  nftTestErrorMockData,
  nftTestMockData,
  testMockUser,
  testMockWallet,
} from '../util/constants'
import { clearDB } from '../util/helpers'
import { getTestApolloServer } from '../util/testApolloServer'

jest.setTimeout(300000)
jest.retryTimes(2)

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
      mockTestServer()
    })
    afterAll(async () => {
      jest.clearAllMocks()
      await testServer.stop()
    })
    // get NFT
    it('should get NFT', async () => {
      const result = await testServer.executeOperation({
        query: `query Nft($contract: Address!, $nftId: String!, $chainId: String!) {
                nft(contract: $contract, id: $nftId, chainId: $chainId) {
                  tokenId
                  contract
                  chainId
                }
              }`,
        variables: {
          contract: nftTestMockData.contract,
          nftId: nftTestMockData.tokenId,
          chainId: nftTestMockData.chainId,
        },
      })
      expect(result?.data?.nft?.contract).toBe(nftTestMockData.contract)
      expect(result?.data?.nft?.tokenId).toBe(nftTestMockData.tokenId)
    })

    // invalid address
    it('should throw contract INVALID ADDRESS', async () => {
      const result = await testServer.executeOperation({
        query: `query Nft($contract: Address!, $nftId: String!, $chainId: String!) {
                nft(contract: $contract, id: $nftId, chainId: $chainId) {
                  tokenId
                  contract
                  chainId
                }
              }`,
        variables: {
          contract: nftTestErrorMockData.contract,
          nftId: nftTestMockData.tokenId,
          chainId: nftTestMockData.chainId,
        },
      })
      expect(result?.errors).toHaveLength(1)
    })

    // correct address, incorrect token
    it('should throw an error', async () => {
      const result = await testServer.executeOperation({
        query: `query Nft($contract: Address!, $nftId: String!, $chainId: String!) {
                nft(contract: $contract, id: $nftId, chainId: $chainId) {
                  tokenId
                  contract
                  id
                  chainId
                }
              }`,
        variables: {
          contract: nftTestMockData.contract,
          nftId: nftTestErrorMockData.tokenId,
          chainId: nftTestMockData.chainId,
        },
      })
      expect(result?.errors).toHaveLength(1)
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
          }
        }`,
        variables: {
          nftByIdId: nftTestMockData.id,
        },
      })
      expect(result?.data?.nftById?.id).toBe(nftTestMockData.id)
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
})
