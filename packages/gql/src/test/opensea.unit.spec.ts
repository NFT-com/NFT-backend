import { delay } from '@nftcom/gql/service/core.service'
import { retrieveOrdersOpensea } from '@nftcom/gql/service/opeansea.service'

jest.setTimeout(150000)

describe('opensea', () => {
  describe('retrieveOrdersOpensea', () => {
    it('it should not retrieve any orders before listing time on testnet', async () => {
      const contract = '0x27af21619746a2abb01d3056f971cde936145939'
      const tokenId = '130'
      const buyOrders = await retrieveOrdersOpensea(contract, tokenId, '4', 0, '1654880000')
      expect(buyOrders.length).toEqual(0)
      await delay(1000)
      const sellOrders = await retrieveOrdersOpensea(contract, tokenId, '4', 1, '1654880000')
      expect(sellOrders.length).toEqual(0)
    })

    it('it should not retrieve any orders before listing time on mainnet', async () => {
      const contract = '0x7EeF591A6CC0403b9652E98E88476fe1bF31dDeb'
      const tokenId = '42'
      const buyOrders = await retrieveOrdersOpensea(contract, tokenId, '1', 0, '165522300')
      expect(buyOrders.length).toEqual(0)
      await delay(1000)
      const sellOrders = await retrieveOrdersOpensea(contract, tokenId, '1', 1, '165522300')
      expect(sellOrders.length).toEqual(0)
    })

    it('it should retrieve undefined', async () => {
      const contract = '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13f'
      const tokenId = '2815'
      const buyOrders = await retrieveOrdersOpensea(contract, tokenId, '4', 0)
      expect(buyOrders).toBeUndefined()
    })
  })
})
