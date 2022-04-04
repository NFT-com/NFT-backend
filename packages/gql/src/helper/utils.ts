import axios from 'axios'

import { gql } from '@nftcom/gql/defs'
import { db, defs,entity } from '@nftcom/shared'

const AUCTION_TYPE_TO_INT: gql.AuctionType[] = [
  gql.AuctionType.FixedPrice, // 0 on chain
  gql.AuctionType.English,    // 1 on chain
  gql.AuctionType.Decreasing, // 2 on chain
]

interface CoinGeckoAsset {
  id: string
  chain_identifier: number | null
  name: string
  shortname: string
}

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

export const fetchPriceFromMarketAskBid = async (
  makeAsset: defs.MarketplaceAsset[],
  chainId: string,
  currency: string,
): Promise<number> => {
  // we only check single asset now
  if (makeAsset.length > 1) return 0
  if (makeAsset[0].standard.assetClass !== defs.AssetClass.ERC20) return 0

  const COINGECKO_API_BASE_URL = 'https://api.coingecko.com/api/v3'
  const platformsUrl = COINGECKO_API_BASE_URL + '/asset_platforms'
  try {
    const result = await axios.get<Array<CoinGeckoAsset>>(platformsUrl)
    const platforms = result.data as Array<CoinGeckoAsset>
    const platform = platforms.find((asset) => asset.chain_identifier === Number(chainId))
    if (!platform) return 0

    const address = makeAsset[0].standard.contractAddress
    const priceUrl = `${COINGECKO_API_BASE_URL}/simple/token_price/${platform.id}?contract_addresses=${address}&vs_currencies=${currency}`
    const priceResult = await axios.get(priceUrl)
    const priceData = priceResult.data
    if (!priceData) return 0
    const usdPrice = priceData[address].usd
    return usdPrice
  } catch (e) {
    return 0
  }
}
