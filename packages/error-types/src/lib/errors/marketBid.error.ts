export enum ErrorType {
  MarketListingNotFound = 'MARKET_LISTING_NOT_FOUND',
  MarketBidInvalid = 'MARKET_BID_INVALID',
  MarketBidExisting = 'MARKET_BID_EXISTING',
  MarketBidNotFound = 'MARKET_BID_NOT_FOUND',
  MarketBidNotOwned = 'MARKET_BID_NOT_OWNED',
  MarketBidUnavailable = 'MARKET_BID_UNAVAILABLE',
  MakerAddressNotOwned = 'MAKER_ADDRESS_NOT_OWNED',
  TxHashInvalid = 'TX_HASH_INVALID',
  MakerNotOwnedProfileOrGK = 'MAKER_NOT_OWNED_PROFILE_OR_GK',
}

export const buildMarketListingNotFoundMsg = (): string => 'MarketListing not found'

export const buildMarketBidInvalidMsg = (): string => 'MarketBid invalid'

export const buildMarketBidExistingMsg = (): string => 'MarketBid is already existing'

export const buildMarketBidNotFoundMsg = (id: string): string => `MarketBid ${id} not found`

export const buildMarketBidNotOwnedMsg = (): string => 'MarketBid not owned'

export const buildMarketBidUnavailableMsg = (walletAddress: string): string =>
  `Active MarketBid is already existing for wallet ${walletAddress} `

export const buildMakerAddressNotOwnedMsg = (): string => 'MakerAddress is not owned'

export const buildTxHashInvalidMsg = (txHash: string): string => `TxHash ${txHash} is not valid`

export const buildMakerNotOwnedProfileOrGK = (address: string): string =>
  `Maker ${address} does not own Genesis key or profile.`
