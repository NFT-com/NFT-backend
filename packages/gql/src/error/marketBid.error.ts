export enum ErrorType {
  MarketAskNotFound = 'MARKET_ASK_NOT_FOUND',
  MarketBidInvalid = 'MARKET_BID_INVALID',
  MarketBidNotFound = 'MARKET_BID_NOT_FOUND',
  MarketBidNotOwned = 'MARKET_BID_NOT_OWNED'
}

export const buildMarketAskNotFoundMsg = (): string => 'MarketAsk not found'

export const buildMarketBidInvalidMsg = (): string => 'MarketBid invalid'

export const buildMarketBidNotFoundMsg = (id: string): string => `MarketBid ${id} not found`

export const buildMarketBidNotOwnedMsg = (): string => 'MarketBid not owned'
