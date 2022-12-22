import { newRepositories } from './db'
import { NFT, TxOrder } from './entity'

const repositories = newRepositories()

export const getNFTsFromTxOrders = async (orders: TxOrder[]): Promise<NFT[]> => {
  const nfts = []
  const nftsSeen = {}
  for (const order of orders) {
    for (const nftId of order.activity.nftId) {
      if (!nftsSeen[nftId]) {
        const idParts = nftId.split('/')
        nfts.push(await repositories.nft.findOne({
          where: {
            contract: idParts[1],
            tokenId: idParts[2],
          },
        }))
        nftsSeen[nftId] = true
      }
    }
  }
  return nfts
}