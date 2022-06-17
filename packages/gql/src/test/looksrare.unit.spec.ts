import { retrieveOrdersLooksrare } from '@nftcom/gql/service/looksare.service'

describe('looksrare', () => {
  describe('retrieveOrdersLooksrare', () => {
    it('it should retrieve correct orders on testnet', async () => {
      const contract = '0x32D74aeab8C07ca66ebE1D441aAd01C688B952cB'
      const tokenId = '1'
      const sellOrders = await retrieveOrdersLooksrare(contract, tokenId, '4', true)
      expect(sellOrders.length).toBeGreaterThan(0)
    })

    it('it should retrieve correct orders on mainnet', async () => {
      const contract = '0x8fB5a7894AB461a59ACdfab8918335768e411414'
      const tokenId = '1802'
      const sellOrders = await retrieveOrdersLooksrare(contract, tokenId, '1', true)
      expect(sellOrders.length).toBeGreaterThan(0)
    })

    it('it should retrieve empty array', async () => {
      const contract = '0x32D74aeab8C07ca66ebE1D441aAd01C688B952cB'
      const tokenId = '1'
      const sellOrders = await retrieveOrdersLooksrare(contract, tokenId, '1', true)
      expect(sellOrders.length).toEqual(0)
    })
  })
})
