import { nftTestErrorMockData, nftTestMockData } from '../util/constants'
import { getTestApolloServer } from '../util/testApolloServer'

jest.mock('@nftcom/gql/service/cache.service', () => ({
  cache: jest.fn(),
  createCacheConnection: jest.fn(),
}))

let testServer

describe('nft resolver', () => {
  beforeAll(async () => {
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
  })

  afterAll(async () => {
    jest.clearAllMocks()
    await testServer.stop()
  })

  describe('get NFT', () => {
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
})
