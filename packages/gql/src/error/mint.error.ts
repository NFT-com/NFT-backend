export enum ErrorType {
  WalletLosing = 'WALLET_LOSING',
}
    
export const buildWalletLosingMsg = (): string => 'This wallet does not have the winning bid for the profile you are trying to mint.'
    