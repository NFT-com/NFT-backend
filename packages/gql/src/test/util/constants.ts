import { DeepPartial } from 'typeorm'

import { NFT, NFTType, Profile, ProfileDisplayType, ProfileLayoutType, ProfileStatus, UpdateProfileInput, User, Wallet } from '@nftcom/gql/defs/gql'

export const testMockUser: User = {
  id: 'test-user-id',
  chainId: '4',
  email: 'rohan@immutableholdings.com',
  isEmailConfirmed: false,
  preferences: {
    bidActivityNotifications: true,
    priceChangeNotifications: true,
    outbidNotifications: true,
    purchaseSuccessNotifications: true,
    promotionalNotifications: true,
  },
  referralId: '',
}

// watchlist user is needed separately for suite to run without duplicates
export const testMockWatchlistUser: User = {
  id: 'test-user-id-watchlist',
  email: 'watchlist@immutableholdings.com',
  isEmailConfirmed: false,
  preferences: {
    bidActivityNotifications: true,
    priceChangeNotifications: true,
    outbidNotifications: true,
    purchaseSuccessNotifications: true,
    promotionalNotifications: true,
  },
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

export const testMockProfiles: Profile = {
  id: 'TQ2tZbp3y3DyXD9iSHUL8',
  bannerURL: 'https://cdn.nft.com/profile-banner-default-logo-key.png',
  createdAt: '2022-07-10T15:31:28.780Z',
  description: 'NFT.com profile for rohantest',
  displayType: ProfileDisplayType.NFT,
  layoutType: ProfileLayoutType.Default,
  followersCount: 0,
  isFollowedByMe: false,
  isOwnedByMe: true,
  gkIconVisible: null,
  nftsDescriptionsVisible: true,
  chainId: '1',
  owner: {
    id: 'test-user-id',
    address: '0x47D3ceD01EF669eF085e041f94820EbE368bF27e',
    chainId: '4',
    chainName: 'rinkeby',
    network: 'ethereum',
    createdAt: '2022-07-10T15:19:57.290Z',
  },
  tokenId: '64',
  photoURL: 'https://cdn.nft.com/dev/profiles/1657467089107-rohantest.svg',
  status: ProfileStatus.Owned,
  url: 'testprofile',

}

export const mockUpdateProfileInput: UpdateProfileInput =
{
  description: 'test description',
  id: 'TQ2tZbp3y3DyXD9iSHUL8',
}

export const nftTestMockData: NFT = {
  id: 'test-nft-id',
  chainId: '4',
  contract: '0xf5de760f2e916647fd766B4AD9E85ff943cE3A2b',
  tokenId: '0x091f1d',
  type: NFTType.ERC721,
  metadata: {
    traits: [],
  },
  createdAt: 'test-timestamp',
  profileId: testMockProfiles.id,
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

export const whitelistedAddress = '0x00518e394761e3b165d3e1809833e3f9b7adb895'

export const nonWhitelistedAddress = '0xDEA2c39552A5bc259c520F64320e2D1008010d44'

export const mockProfilesData: Array<DeepPartial<Profile>> = [
  {
    id: 'test-id-1',
    photoURL: null,
  },
  {
    id: 'test-id-2',
    photoURL: null,
  },
  {
    id: 'test-id-3',
    photoURL: null,
  },
  {
    id: 'test-id-4',
    photoURL: null,
  },
  {
    id: 'test-id-5',
    photoURL: null,
  },
]
