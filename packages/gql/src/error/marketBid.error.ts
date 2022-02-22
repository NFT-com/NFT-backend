export enum ErrorType {
  MarketAskNotFound = 'MARKET_ASK_NOT_FOUND',
  MarketBidInvalid = 'MARKET_BID_INVALID',
}
    
export const buildMarketAskNotFoundMsg = (): string => 'MarketAsk not found'
export const buildMarketBidInvalidMsg = (): string => 'MarketBid invalid'