export enum ErrorType {
  MarketSwapInvalid = 'MARKET_SWAP_INVALID',
  MarketSwapExisting = 'MARKET_SWAP_EXISTING',
  TxHashInvalid = 'TX_HASH_INVALID',
}

export const buildMarketSwapInvalidMsg = (): string => 'MarketSwap invalid'

export const buildMarketSwapExistingMsg = (): string => 'MarketSwap is already existing'

export const buildTxHashInvalidMsg = (txHash: string): string => `TxHash ${txHash} is not valid`
