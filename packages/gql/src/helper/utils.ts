import { gql } from '@nftcom/gql/defs'

const AUCTION_TYPE_TO_INT: gql.AuctionType[] = [
  gql.AuctionType.FixedPrice, // 0 on chain
  gql.AuctionType.English,    // 1 on chain
  gql.AuctionType.Decreasing, // 2 on chain
]

export const auctionTypeToInt = (auctionType: gql.AuctionType): number => {
  return AUCTION_TYPE_TO_INT.indexOf(auctionType)
}

export const getRandomFloat = (min, max, decimals): number => {
  const str = (Math.random() * (max - min) + min).toFixed(decimals)

  return parseFloat(str)
}