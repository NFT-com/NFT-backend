import {
  LooksrareExternalOrder,
  LooksRareOrderRequest,
  retrieveMultipleOrdersLooksrare,
} from '@nftcom/gql/service/looksare.service'

describe('looksrare', () => {
  describe('retrieveMultipleOrdersLooksrare', () => {
    it('it should retrieve empty listing and offers', async () => {
      const contract = '0x32D74aeab8C07ca66ebE1D441aAd01C688B952cB'
      const tokenId = '1'

      const chainId = '5'

      const looksrareOrderReq: LooksRareOrderRequest[] = [
        {
          contract: contract,
          tokenId: tokenId,
          chainId,
        },
      ]

      const orders: LooksrareExternalOrder = await retrieveMultipleOrdersLooksrare(looksrareOrderReq, chainId, true)

      expect(orders.listings).toHaveLength(0)
      expect(orders.offers).toHaveLength(0)
    })
  })
})
