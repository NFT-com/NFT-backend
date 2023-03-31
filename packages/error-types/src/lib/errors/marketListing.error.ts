export enum ErrorType {
  MarketListingInvalid = 'MARKET_LISTING_INVALID',
  MarketListingExisting = 'MARKET_LISTING_EXISTING',
  MarketListingNotFound = 'MARKET_LISTING_NOT_FOUND',
  MarketListingNotOwned = 'MARKET_LISTING_NOT_OWNED',
  MarketListingBought = 'MARKET_LISTING_BOUGHT',
  MarketListingUnavailable = 'MARKET_LISTING_UNAVAILABLE',
  MakerAddressNotOwned = 'MAKER_ADDRESS_NOT_OWNED',
  MissingBuyNowInfo = 'MISSING_BUY_NOW_INFO',
  TxHashInvalid = 'TX_HASH_INVALID',
  AuctionTypeInvalid = 'AUCTION_TYPE_INVALID',
}

export const buildMarketListingInvalidMsg = (): string => 'MarketListing invalid'

export const buildMarketListingExistingMsg = (): string => 'MarketListing is already existing'

export const buildMarketListingNotFoundMsg = (id: string): string => `MarketListing ${id} not found`

export const buildMarketListingNotOwnedMsg = (caller: string, id: string): string =>
  `Caller ${caller} does not own marketListing id: ${id}`

export const buildMarketListingBoughtMsg = (): string => 'MarketListing is already bought'

export const buildMissingBuyNowInfoMsg = (txHash: string): string => `TxHash ${txHash} is missing BuyNowInfo`

export const buildTxHashInvalidMsg = (txHash: string): string => `TxHash ${txHash} is not valid`

export const buildAuctionTypeInvalidMsg = (): string => 'Auction type is not valid'

export const buildMarketListingUnavailableMsg = (walletAddress: string): string =>
  `MarketListing with same asset is already existing for wallet ${walletAddress} `

export const buildMakerAddressNotOwnedMsg = (): string => 'MakerAddress is not owned'
