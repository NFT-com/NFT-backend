export enum ErrorType {
  MarketAskInvalid = 'MARKET_ASK_INVALID',
  MarketAskNotFound = 'MARKET_ASK_NOT_FOUND',
  MarketAskNotOwned = 'MARKET_ASK_NOT_OWNED',
  MarketAskBought = 'MARKET_ASK_BOUGHT',
  MarketAskUnavailable = 'MARKET_ASK_UNAVAILABLE',
  MakerAddressNotOwned = 'MAKER_ADDRESS_NOT_OWNED',
  TxHashInvalid = 'TX_HASH_INVALID',
  AuctionTypeInvalid = 'AUCTION_TYPE_INVALID'
}

export const buildMarketAskInvalidMsg = (): string => 'MarketAsk invalid'

export const buildMarketAskNotFoundMsg = (id: string): string => `MarketAsk ${id} not found`

export const buildMarketAskNotOwnedMsg = (caller: string, id: string): string => `Caller ${caller} does not own marketAsk id: ${id}`

export const buildMarketAskBoughtMsg = (): string => 'MarketAsk is already bought'

export const buildTxHashInvalidMsg = (txHash: string): string => `TxHash ${txHash} is not valid`

export const buildAuctionTypeInvalidMsg = (): string => 'Auction type is not valid'

export const buildMarketAskUnavailableMsg = (walletAddress: string): string => `MarketAsk with same asset is already existing for wallet ${walletAddress} `

export const buildMakerAddressNotOwnedMsg = (): string => 'MakerAddress is not owned'
