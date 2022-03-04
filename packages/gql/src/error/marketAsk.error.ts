export enum ErrorType {
  MarketAskInvalid = 'MARKET_ASK_INVALID',
  MarketAskNotFound = 'MARKET_ASK_NOT_FOUND',
  MarketAskNotOwned = 'MARKET_ASK_NOT_OWNED'
}
    
export const buildMarketAskInvalidMsg = (): string => 'MarketAsk invalid'

export const buildMarketAskNotFoundMsg = (id: string): string => `MarketAsk ${id} not found`

export const buildMarketAskNotOwnedMsg = (caller: string, id: string): string => `Caller ${caller} does not own marketAsk id: ${id}`