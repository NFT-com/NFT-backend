import { nftTestMockData } from '../util/constants'
import { getTestApolloServer } from '../util/testApolloServer'

let testServer

describe('nft resolver', () => {
  beforeAll(async () => {
    const mockArgs ={
      contract: nftTestMockData.contract,
      tokenId: nftTestMockData.tokenId,
    }
    testServer = getTestApolloServer({
      nft: {
        findById: (id: string) => Promise.resolve({
          id,
          contract: mockArgs.contract,
          tokenId: mockArgs.tokenId,
        }),
        findOne: ({ where: mockArgs }) => Promise.resolve({
          contract: mockArgs.contract,
          tokenId: mockArgs.tokenId,
        }),
      },
    },
    )
  })

  afterAll(async () => {
    jest.clearAllMocks()
    await testServer.stop()
  })

  describe('getNFT', () => {
    // get NFT
    it('should get NFT', async () => {
      const result = await testServer.executeOperation({
        query: `query Nft($contract: Address!, $nftId: String!) {
                nft(contract: $contract, id: $nftId) {
                  tokenId
                  contract
                }
              }`,
        variables: {
          contract: nftTestMockData.contract,
          nftId: nftTestMockData.tokenId,
        },
      })
      expect(result?.data?.nft?.contract).toBe(nftTestMockData.contract)
      expect(result?.data?.nft?.tokenId).toBe(nftTestMockData.tokenId)
    })

    // invalid address
    it('should throw contract INVALID ADDRESS', async () => {
      const result = await testServer.executeOperation({
        query: `query Nft($contract: Address!, $nftId: String!) {
                nft(contract: $contract, id: $nftId) {
                  tokenId
                  contract
                }
              }`,
        variables: {
          contract: nftTestMockData.errorContract,
          nftId: nftTestMockData.tokenId,
        },
      })
      expect(result?.errors).toHaveLength(1)
    })

    // correct address, incorrect token
    it('should throw an error', async () => {
      const result = await testServer.executeOperation({
        query: `query Nft($contract: Address!, $nftId: String!) {
                nft(contract: $contract, id: $nftId) {
                  tokenId
                  contract
                  id
                }
              }`,
        variables: {
          contract: nftTestMockData.contract,
          nftId: nftTestMockData.errorTokenId,
        },
      })
      expect(result?.errors).toHaveLength(1)
    })
  })
})