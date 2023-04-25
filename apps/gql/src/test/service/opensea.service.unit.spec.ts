import {
  OpenseaExternalOrder,
  OpenseaOrderRequest,
  retrieveMultipleOrdersOpensea,
} from '@nftcom/gql/service/opensea.service'

jest.setTimeout(150000)

jest.mock('@nftcom/cache', () => ({
  redisConfig: {},
  cache: jest.fn(),
  createCacheConnection: jest.fn(),
}))

describe('opensea', () => {
  describe('retrieveMultipleOrdersOpensea', () => {
    it('should retrieve empty listings and offers', async () => {
      const contract = '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13f'
      const tokenId = '2815'
      const chainId = '5'
      const openseaOrderReq: OpenseaOrderRequest[] = [
        {
          contract,
          tokenId,
          chainId,
        },
      ]
      const orders: OpenseaExternalOrder = await retrieveMultipleOrdersOpensea(openseaOrderReq, chainId, true)
      expect(orders.listings).toHaveLength(0)
      expect(orders.offers).toHaveLength(0)
    })
  })
})
