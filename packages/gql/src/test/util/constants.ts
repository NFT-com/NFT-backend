import { User, Wallet } from '@nftcom/gql/defs/gql'

export const testMockUser: User = {
  id: 'test-user-id',
  isEmailConfirmed: false,
  preferences: null,
  referralId: '',
}

export const testMockWallet: Wallet = {
  id: 'test-wallet-id',
  address: '0xf5de760f2e916647fd766B4AD9E85ff943cE3A2b',
  chainId: '4',
  chainName: 'rinkeby',
  network: 'ethereum',
  createdAt: 'test-timestamp',
}

export const nftTestMockData = {
  contract: '0xf5de760f2e916647fd766B4AD9E85ff943cE3A2b',
  tokenId: '0x091f1d',
  errorContract: '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13ds',
  errorTokenId: '1',
}