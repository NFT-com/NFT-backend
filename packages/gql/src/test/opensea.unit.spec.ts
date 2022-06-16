import { delay } from '@nftcom/gql/service/core.service'
import { retrieveOrdersOpensea } from '@nftcom/gql/service/opeansea.service'

jest.setTimeout(150000)

describe('opensea', () => {
  describe('retrieveOrdersOpensea', () => {
    it('it should retrieve correct orders on testnet', async () => {
      const contract = '0x27af21619746a2abb01d3056f971cde936145939'
      const tokenId = '130'
      const buyOrders = await retrieveOrdersOpensea(contract, tokenId, '4', 0)
      expect(buyOrders).toBeDefined()
      await delay(1000)
      const sellOrders = await retrieveOrdersOpensea(contract, tokenId, '4', 1)
      expect(sellOrders).toBeDefined()
    })

    it('it should retrieve correct orders on testnet', async () => {
      const contract = '0x88b48f654c30e99bc2e4a1559b4dcf1ad93fa656'
      const tokenId = '7705174452174363759870282025590767633334504664605582958835231443605377777665'
      const buyOrders = await retrieveOrdersOpensea(contract, tokenId, '4', 0)
      expect(buyOrders).toBeDefined()
      await delay(1000)
      const sellOrders = await retrieveOrdersOpensea(contract, tokenId, '4', 1)
      expect(sellOrders).toBeDefined()
    })

    it('it should retrieve correct orders on testnet', async () => {
      const contract = '0x85875f6e3336374b823582d1e32a8c1252240601'
      const tokenId = '4'
      const buyOrders = await retrieveOrdersOpensea(contract, tokenId, '4', 0)
      expect(buyOrders).toBeDefined()
      await delay(1000)
      const sellOrders = await retrieveOrdersOpensea(contract, tokenId, '4', 1)
      expect(sellOrders).toBeDefined()
    })

    it('it should retrieve correct orders on mainnet', async () => {
      const contract = '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d'
      const tokenId = '2815'
      const buyOrders = await retrieveOrdersOpensea(contract, tokenId, '1', 0)
      expect(buyOrders).toBeDefined()
      await delay(1000)
      const sellOrders = await retrieveOrdersOpensea(contract, tokenId, '1', 1)
      expect(sellOrders).toBeDefined()
    })

    it('it should retrieve undefined', async () => {
      const contract = '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13f'
      const tokenId = '2815'
      const buyOrders = await retrieveOrdersOpensea(contract, tokenId, '4', 0)
      expect(buyOrders).toBeUndefined()
    })
  })
})
