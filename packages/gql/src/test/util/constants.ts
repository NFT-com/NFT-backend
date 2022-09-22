import { DeepPartial } from 'typeorm'

import { ActivityStatus, NFT, NFTType, Profile, ProfileDisplayType, ProfileLayoutType, ProfileStatus, ProtocolData, TxActivity, UpdateProfileInput, User, Wallet } from '@nftcom/gql/defs/gql'
import { LooksRareOrder } from '@nftcom/gql/service/looksare.service'
import { SeaportOrder } from '@nftcom/gql/service/opensea.service'
import { entity } from '@nftcom/shared'
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

export const nftAMockDataNullPreview: Partial<entity.NFT> = {
  id: 'test-nft-id-A',
  chainId: '4',
  contract: '0xf5de760f2e916647fd766B4AD9E85ff943cE3A2x',
  tokenId: '0x091f1x',
  type: NFTType.ERC721,
  metadata: {
    name: '',
    imageURL: '',
    description: '',
    traits: [],
  },
  price: '1',
  memo: '',
  lastRefreshed: new Date('2022-09-21 19:09:44.102746+00'),
  updatedAt: new Date('2022-09-21 19:09:44.102746+00'),
  createdAt: new Date('2022-09-21 19:09:44.102746+00'),
  userId: testMockUser.id,
  walletId: testMockWallet.id,
  profileId: testMockProfiles.id,
  previewLink: null,
  previewLinkError: null,
}

export const nftBMockDataNullPreview: Partial<entity.NFT> = {
  id: 'test-nft-id-B',
  chainId: '4',
  contract: '0xf5de760f2e916647fd766B4AD9E85ff943cE3A2b',
  tokenId: '0x091f1d',
  type: NFTType.ERC721,
  metadata: {
    name: '',
    imageURL: '',
    description: '',
    traits: [],
  },
  price: '1',
  memo: '',
  lastRefreshed: new Date('2022-09-21 19:09:44.102746+00'),
  updatedAt: new Date('2022-09-21 19:09:44.102746+00'),
  createdAt: new Date('2022-09-21 19:09:44.102746+00'),
  userId: testMockUser.id,
  walletId: testMockWallet.id,
  profileId: testMockProfiles.id,
  previewLink: null,
  previewLinkError: null,
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
    address: '0x47D3ceD01EF669eF085e041f94820EbE368bF27e',
  },
  taker: {
    address: '0x47D3ceD01EF669eF085e041f94820EbE368bF27e',
  },
  cancelled: false,
  finalized: false,
  marked_invalid: false,
  approved_on_chain: false,
  protocol_data: {
    parameters: {
      offerer: '0x47D3ceD01EF669eF085e041f94820EbE368bF27e',
      offer: [{
        itemType: 3,
        token: '0x47D3ceD01EF669eF085e041f94820EbE368bF27e',
        identifierOrCriteria: '1234',
        startAmount: '1',
        endAmount: '1',
      }],
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
    signature: '0x47D3ceD01EF669eF085e041f94820EbE368bF27e',
  },
  protocol_address: '0x47D3ceD01EF669eF085e041f94820EbE368bF27e',
  maker_fees: [{
    account: {
      address: '0x47D3ceD01EF669eF085e041f94820EbE368bF27e',
    },
    basis_points: '250',
  }],
  taker_fees: null,
  side: 'ask',
  order_type: 'basic',
  client_signature: '0x47D3ceD01EF669eF085e041f94820EbE368bF27e',
  relay_id: 'test-relay-id',
  criteria_proof: 'test-criteria-proof',
}

export const testLooksrareOrder: LooksRareOrder = {
  hash: 'test-order-hash',
  collectionAddress: '0x47D3ceD01EF669eF085e041f94820EbE368bF27e',
  tokenId: '1234',
  isOrderAsk: false,
  signer: '0x47D3ceD01EF669eF085e041f94820EbE368bF27e',
  strategy: '0x47D3ceD01EF669eF085e041f94820EbE368bF27e',
  currencyAddress: '0x47D3ceD01EF669eF085e041f94820EbE368bF27e',
  amount: 10,
  price: '10',
  nonce: 'test-nonce',
  startTime: 12345,
  endTime: 12345,
  minPercentageToAsk: 1,
  params: '',
  status: '',
  signature: '0x47D3ceD01EF669eF085e041f94820EbE368bF27e',
  v: 1,
  r: 'test-r',
  s: 'test-s',
}

export const testLooksrareExistingOrder: LooksRareOrder = {
  hash: 'test-existing-order-hash',
  collectionAddress: '0x47D3ceD01EF669eF085e041f94820EbE368bF27e',
  tokenId: '123',
  isOrderAsk: true,
  signer: '0x47D3ceD01EF669eF085e041f94820EbE368bF27e',
  strategy: '0x47D3ceD01EF669eF085e041f94820EbE368bF27e',
  currencyAddress: '0x47D3ceD01EF669eF085e041f94820EbE368bF27e',
  amount: 10,
  price: '10',
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
  walletAddress: '0x47D3ceD01EF669eF085e041f94820EbE368bF27e',
  activityType: ActivityType.Listing,
  activityTypeId: 'test-existing-order-hash',
  status: ActivityStatus.Valid,
  read: false,
  timestamp: 'test-timestamp',
  nftContract: '0x47D3ceD01EF669eF085e041f94820EbE368bF27e',
  nftId: ['ethereum/0x47D3ceD01EF669eF085e041f94820EbE368bF27e/123'],
  order: {
    id: 'test-existing-order-hash',
    exchange: ExchangeType.LooksRare,
    makerAddress: '0x47D3ceD01EF669eF085e041f94820EbE368bF27e',
    orderHash: 'test-existing-order-hash',
    orderType: ActivityType.Listing,
    protocol: ProtocolType.LooksRare,
  },
}

export const seaportProtocolData: ProtocolData = {
  parameters: {
    offerer: '0x86c8203fe8f7d60afaa0bdda4d92cc5abd901578',
    offer: [
      {
        itemType: 2,
        token: '0x41da98f744BE9ae23c425147289db704Db942417',
        identifierOrCriteria: '317',
        startAmount: '1',
        endAmount: '1',
      },
    ],
    consideration: [
      {
        itemType: 0,
        token: '0x0000000000000000000000000000000000000000',
        identifierOrCriteria: '0',
        startAmount: '21060000000000000',
        endAmount: '21060000000000000',
        recipient: '0x86C8203Fe8F7d60Afaa0bddA4d92cc5abd901578',
      },
      {
        itemType: 0,
        token: '0x0000000000000000000000000000000000000000',
        identifierOrCriteria: '0',
        startAmount: '585000000000000',
        endAmount: '585000000000000',
        recipient: '0x0000a26b00c1F0DF003000390027140000fAa719',
      },
      {
        itemType: 0,
        token: '0x0000000000000000000000000000000000000000',
        identifierOrCriteria: '0',
        startAmount: '1755000000000000',
        endAmount: '1755000000000000',
        recipient: '0xDC6A9CE51a4e3F82434DAF0AB953733A3cf99419',
      },
    ],
    startTime: '1662147396',
    endTime: '1664739396',
    orderType: 2,
    zone: '0x004C00500000aD104D7DBd00e3ae0A5C00560C00',
    zoneHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
    salt: '20355692518651699',
    conduitKey: '0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000',
    totalOriginalConsiderationItems: 3,
    counter: 1,
  },
  signature: '0x13cb5579ce2c24c79316577862338fca160b85bf49a520c1cb4288ba93d9c0094bca5295861751c76fe847c2ccad572b8e693cbcb94a9146e930243823032f141b',
}

export const looksrareProtocolData: ProtocolData = {
  isOrderAsk: true,
  signer: '0x86C8203Fe8F7d60Afaa0bddA4d92cc5abd901578',
  collectionAddress: '0xEc8d2c7767c1aE1c8f3D34ED380B9344D59096a1',
  price: '1000000000000000',
  tokenId: '605',
  amount: '1',
  strategy: '0x56244Bb70CbD3EA9Dc8007399F61dFC065190031',
  currencyAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  nonce: '20',
  startTime: '1662157499',
  endTime: '1662243899',
  minPercentageToAsk: '9800',
  params: '0x',
  v: '27',
  r: '0x0769c55fdc97d9324bb766d44dc2cff34062abf3fc0394c2846434f6391a2240',
  s: '0x097c479c4f7aecd81de313d6edd22e0a52596baa8f8239126a4f842b228d3feb',
}
