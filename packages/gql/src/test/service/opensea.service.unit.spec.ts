import { OpenseaExternalOrder, OpenseaOrderRequest, retrieveMultipleOrdersOpensea, retrieveOrdersOpensea } from '@nftcom/gql/service/opensea.service'

jest.setTimeout(150000)

jest.mock('@nftcom/gql/service/cache.service', () => ({
  cache: jest.fn(),
  createCacheConnection: jest.fn(),
}))

describe('opensea', () => {
  describe('retrieveOrdersOpensea', () => {
    // TODO: jason to add more
    // it('it should not retrieve any orders before listing time on testnet', async () => {
    //   const contract = '0x27af21619746a2abb01d3056f971cde936145939'
    //   const tokenId = '130'
    //   const allOrders = await retrieveOrdersOpensea(contract, tokenId, '4')
    //   expect(allOrders.listings.length).toEqual(0)
    //   expect(allOrders.offers.length).toEqual(0)
    // })

    // it('it should not retrieve any orders before listing time on mainnet', async () => {
    //   const contract = '0x7EeF591A6CC0403b9652E98E88476fe1bF31dDeb'
    //   const tokenId = '42'
    //   const allOrders = await retrieveOrdersOpensea(contract, tokenId, '1')
    //   expect(allOrders.listings.length).toEqual(0)
    //   expect(allOrders.offers.length).toEqual(0)
    // })

    it('it should retrieve undefined', async () => {
      const contract = '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13f'
      const tokenId = '2815'
      const buyOrders = await retrieveOrdersOpensea(contract, tokenId, '4')
      expect(buyOrders).toBeUndefined()
    })
  })
  describe('retrieveMultipleOrdersOpensea', () => {
    it('should retrieve empty listings and offers', async () => {
      const contract = '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13f'
      const tokenId = '2815'
      const chainId = '4'
      const openseaOrderReq: OpenseaOrderRequest[] = [{
        contract,
        tokenId,
        chainId,
      }]
      const orders: OpenseaExternalOrder = await retrieveMultipleOrdersOpensea(
        openseaOrderReq,
        chainId,
        true,
      )
      expect(orders.listings).toHaveLength(0)
      expect(orders.offers).toHaveLength(0)
    })
  })
})
