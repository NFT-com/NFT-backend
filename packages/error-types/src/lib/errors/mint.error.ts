export enum ErrorType {
  WalletLosing = 'WALLET_LOSING',
  ProfileClaimTransaction = 'PROFILE_CLAIM_TRANSATION',
  WalletEmpty = 'WALLET_EMPTY',
}

export const buildWalletLosingMsg = (): string =>
  'This wallet does not have the winning bid for the profile you are trying to mint.'

export const buildInvalidProfileClaimTransaction = (): string =>
  'This transaction does not show the input Wallet claiming the input Profile'

export const buildWalletEmpty = (): string => 'There is not an associated wallet for this profile.'
