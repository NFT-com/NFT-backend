import { gql } from '@nftcom/gql/defs'
import { db, entity } from '@nftcom/shared'

const AUCTION_TYPE_TO_INT: gql.AuctionType[] = [
  gql.AuctionType.FixedPrice, // 0 on chain
  gql.AuctionType.English,    // 1 on chain
  gql.AuctionType.Decreasing, // 2 on chain
]

export const auctionTypeToInt = (auctionType: gql.AuctionType): number => {
  return AUCTION_TYPE_TO_INT.indexOf(auctionType)
}

export const fetchUserFromMarketAskBid = async (
  makeAddress: string,
  chainId: string,
  repositories: db.Repository,
): Promise<entity.User> => {
  const wallet = await repositories.wallet.findByChainAddress(chainId, makeAddress)
  if (wallet) {
    const user = await repositories.user.findById(wallet.userId)
    return user
  }
}
