export enum ErrorType {
  MarketSwapInvalid = 'MARKET_SWAP_INVALID',
  MarketAskBought = 'MARKET_SWAP_BOUGHT',
  MarketSwapExisting = 'MARKET_SWAP_EXISTING',
  TxHashInvalid = 'TX_HASH_INVALID'
}

export const buildMarketSwapInvalidMsg = (): string => 'MarketSwap invalid'

export const buildMarketAskBoughtMsg = (): string => 'MarketAsk is already bought'

export const buildMarketSwapExistingMsg = (): string => 'MarketAsk is already existing'

export const buildTxHashInvalidMsg = (txHash: string): string => `TxHash ${txHash} is not valid`
