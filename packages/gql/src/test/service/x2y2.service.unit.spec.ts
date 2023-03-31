import { retrieveMultipleOrdersX2Y2, X2Y2ExternalOrder, X2Y2OrderRequest } from '@nftcom/gql/service/x2y2.service'

describe('x2y2', () => {
  describe('retrieveMultipleOrdersX2Y2', () => {
    it('it should retrieve empty listing and offers', async () => {
      const contract = '0x32D74aeab8C07ca66ebE1D441aAd01C688B952cB'
      const tokenId = '1'

      const chainId = '5'

      const x2y2OrderReq: X2Y2OrderRequest[] = [
        {
          contract: contract,
          tokenId: tokenId,
          chainId,
        },
      ]

      const orders: X2Y2ExternalOrder = await retrieveMultipleOrdersX2Y2(x2y2OrderReq, chainId, true)

      expect(orders.listings).toHaveLength(0)
      expect(orders.offers).toHaveLength(0)
    })
  })
})
