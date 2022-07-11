import { NFT, NFTType, User, Wallet } from '@nftcom/gql/defs/gql'

export const testMockUser: User = {
  id: 'test-user-id',
  email: 'rohan@immutableholdings.com',
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

export const nftTestMockData: NFT = {
  id: 'test-nft-id',
  contract: '0xf5de760f2e916647fd766B4AD9E85ff943cE3A2b',
  tokenId: '0x091f1d',
  type: NFTType.ERC721,
  metadata: {
    traits: [],
  },
  createdAt: 'test-timestamp',
}

export const nftTestErrorMockData: NFT = {
  id: 'test-nft-error-id',
  contract: '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13ds',
  tokenId: '1',
  type: NFTType.ERC721,
  metadata: {
    traits: [],
  },
  createdAt: 'test-timestamp',
}

export const whitelistedAddress = '0xDF3c501ef5aBeFff2d7Ce1eB75B205F60C66778A'

export const nonWhitelistedAddress = '0xDEA2c39552A5bc259c520F64320e2D1008010d44'
