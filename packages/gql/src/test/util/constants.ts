import { DeepPartial } from 'typeorm'

import { NFT, NFTType, Profile, ProfileDisplayType, ProfileLayoutType, ProfileStatus, TxActivity, UpdateProfileInput, User, Wallet } from '@nftcom/gql/defs/gql'
import { LooksRareOrder } from '@nftcom/gql/service/looksare.service'
import { SeaportOrder } from '@nftcom/gql/service/opensea.service'
import { ActivityType, ExchangeType, ProtocolType } from '@nftcom/shared/defs'

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
  deployedContractsVisible: false,
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
  deployedContractsVisible: true,
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

export const testSeaportOrder : SeaportOrder = {
  created_date: 'test-created-date',
  closing_date: 'test-closing-date',
  closing_extendable: false,
  expiration_time: 12345,
  listing_time: 12345,
  order_hash: 'test-order-hash',
  current_price: 'test-current-price',
  maker: {
    address: 'test-maker',
  },
  taker: {
    address: 'test-taker',
  },
  cancelled: false,
  finalized: false,
  marked_invalid: false,
  approved_on_chain: false,
  protocol_data: {
    parameters: {
      offerer: 'test-maker',
      offer: [],
      consideration: [],
      startTime: '12345',
      endTime: '12345',
      orderType: 0,
      zone: 'test-zone',
      zoneHash: 'test-zone-hash',
      salt: 'test-salt',
      conduitKey: 'test-conduit-key',
      totalOriginalConsiderationItems: 1,
      counter: 1,
    },
    signature: 'test-signature',
  },
  protocol_address: 'test-protocol-address',
  maker_fees: {},
  taker_fees: {},
  side: 'ask',
  order_type: 'basic',
  client_signature: 'test-s,ignature',
  relay_id: 'test-relay-id',
  criteria_proof: 'test-criteria-proof',
}

export const testLooksrareOrder: LooksRareOrder = {
  hash: 'test-order-hash',
  collectionAddress: 'test-collection-address',
  tokenId: 'test-token-id',
  isOrderAsk: false,
  signer: 'test-signer',
  strategy: 'test-strategy',
  currencyAddress: 'test-currency-address',
  amount: 10,
  price: 10,
  nonce: 'test-nonce',
  startTime: 12345,
  endTime: 12345,
  minPercentageToAsk: 1,
  params: '',
  status: '',
  signature: 'test-signature',
  v: 1,
  r: 'test-r',
  s: 'test-s',
}

export const testLooksrareExistingOrder: LooksRareOrder = {
  hash: 'test-existing-order-hash',
  collectionAddress: 'test-collection-address',
  tokenId: 'test-token-id',
  isOrderAsk: true,
  signer: 'test-signer',
  strategy: 'test-strategy',
  currencyAddress: 'test-currency-address',
  amount: 10,
  price: 10,
  nonce: 'test-nonce',
  startTime: 12345,
  endTime: 12345,
  minPercentageToAsk: 1,
  params: '',
  status: '',
  signature: 'test-signature',
  v: 1,
  r: 'test-r',
  s: 'test-s',
}

export const testExistingActivity: TxActivity = {
  id: 'test-activity-id',
  walletId: 'test-wallet-id',
  activityType: ActivityType.Listing,
  activityTypeId: 'test-existing-order-hash',
  read: false,
  timestamp: 'test-timestamp',
  order: {
    id: 'test-existing-order-hash',
    exchange: ExchangeType.LooksRare,
    makerAddress: 'test-maker-address',
    orderHash: 'test-existing-order-hash',
    orderType: ActivityType.Listing,
    protocol: ProtocolType.LooksRare,
  },
}
