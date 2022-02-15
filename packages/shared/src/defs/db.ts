import { EntityFieldsNames } from 'typeorm/common/EntityFieldsNames'
import { OrderByCondition } from 'typeorm/find-options/OrderByCondition'

export enum EntityType {
  Approval = 'Approval',
  Bid = 'Bid',
  Curation = 'Curation',
  Collection = 'Collection',
  Edge = 'Edge',
  NFT = 'NFT',
  Profile = 'Profile',
  User = 'User',
  Wallet = 'Wallet'
}

export enum EdgeType {
  Follows = 'Follows',
  Referred = 'Referred',
  Displays = 'Displays',
  Includes = 'Includes'
}

export enum BidStatus {
  Executed = 'Executed',
  Submitted = 'Submitted'
}

export enum NFTType {
  ERC721 = 'ERC721',
  ERC1155 = 'ERC1155',
  Profile = 'Profile',
  GenesisKey = 'GenesisKey',
  GenesisKeyProfile = 'GenesisKeyProfile'
}

export enum NFTSize {
  Small = 'Small',
  Medium = 'Medium',
  Large = 'Large'
}

export enum AssetClass {
  ETH_ASSET_CLASS = 'ETH',
  ERC20_ASSET_CLASS = 'ERC20',
  ERC721_ASSET_CLASS = 'ERC721',
  ERC1155_ASSET_CLASS = 'ERC1155',
  CRYPTO_PUNK = 'CRYPTO_PUNK',
}

export type CurationItem = {
  size?: NFTSize
  id: string
}

export type AssetType = {
  assetClass: AssetClass
  bytes: string // encoded data; (address, uint256, bool) = (contract address, tokenId - only NFTs, allow all from collection - only NFTs) if allow all = true, ignore tokenId...
  contractAddress: string
  tokenId?: string
  allowAll: boolean
}

export type MarketplaceAsset = {
  standard: AssetType
  bytes: string // encoded data; (uint256, uint256) = (value, minimumBid)
  value: number
  minimumBid: number
}

export type Trait = {
  type: string
  value: string
}

export type NFTMetadata = {
  imageURL: string
  name: string
  description: string
  traits: Trait[]
}

export type UserPreferences = {
  bidActivityNotifications: boolean
  priceChangeNotifications: boolean
  outbidNotifications: boolean
  purchaseSuccessNotifications: boolean
  promotionalNotifications: boolean
}

export enum ProfileStatus {
  Available = 'Available',
  Pending = 'Pending',
  Owned = 'Owned'
}

export type Signature = {
  v: number
  r: string
  s: string
}

export type OrderBy = { [P in EntityFieldsNames]?: 'ASC' | 'DESC' | 1 | -1 } & OrderByCondition

export type DBConfig = {
  host: string
  port: number
  user: string
  password: string
  database: string
  logging: boolean
  useSSL: boolean
}

export type PageableResult<T> = [T[], number]

export type DistinctOn<T> = Extract<keyof T, string>[]

export type PageableQuery<T> = {
  filter: Partial<T>
  orderBy: OrderBy
  take: number
  distinctOn?: DistinctOn<T>
}

export type FindPageableFn<T> = (query: PageableQuery<T>) => Promise<PageableResult<T>>
