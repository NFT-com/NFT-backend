import { FindOperator } from 'typeorm'
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
  Includes = 'Includes',
  Watches = 'Watches'
}

export enum BidStatus {
  Executed = 'Executed',
  Submitted = 'Submitted'
}

export enum NFTType {
  ERC721 = 'ERC721',
  ERC1155 = 'ERC1155',
  UNKNOWN = 'UNKNOWN',
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
  ETH = 'ETH',
  ERC20 = 'ERC20',
  ERC721 = 'ERC721',
  ERC1155 = 'ERC1155'
}

export type CurationItem = {
  size?: NFTSize
  id: string
}

export type AssetType = {
  assetClass: AssetClass
  bytes: string // encoded data; (address, uint256, bool) = (contract address, tokenId - only NFTs, allow all from collection - only NFTs) if allow all = true, ignore tokenId...
  contractAddress: string
  tokenId: string
  allowAll: boolean
}

export type MarketplaceAsset = {
  standard: AssetType
  nftId: string
  bytes: string // encoded data; (uint256, uint256) = (value, minimumBid)
  value: string
  minimumBid: string
}

export enum AuctionType {
  FixedPrice = 'FixedPrice',
  English = 'English',
  Decreasing = 'Decreasing',
}

export enum ActivityType {
  Listing = 'Listing',
  Bid = 'Bid',
  Cancel = 'Cancel',
  Sale = 'Sale',
  Transfer = 'Transfer',
}

export enum ActivityStatus {
  Valid = 'Valid',
  Cancelled = 'Cancelled',
  Executed = 'Executed'
}

export enum ExchangeType {
  OpenSea = 'OpenSea',
  LooksRare = 'LooksRare',
}

export enum ProtocolType {
  Seaport = 'Seaport',
  LooksRare = 'LooksRare',
}

export const CancelActivities = [ActivityType.Listing, ActivityType.Bid] as const
export type CancelActivityType = typeof CancelActivities[number]

export enum CurrencyType {
  ETH = 'ETH',
  WETH = 'WETH',
  USDC = 'USDC',
  DAI = 'DAI'
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

export enum ProfileDisplayType {
  NFT = 'NFT',
  Collection = 'Collection',
}

export enum ProfileLayoutType {
  Default = 'Default',
  Mosaic = 'Mosaic',
  Featured = 'Featured',
  Spotlight = 'Spotlight',
}

export enum ProfileViewType {
  Collection = 'Collection',
  Gallery = 'Gallery',
}

export type Signature = {
  v: number
  r: string
  s: string
}
export interface ActivityFilters {
  chainId: string
  walletAddress?: string
  activityType?: ActivityType
  read?: boolean
  tokenId?: string
  contract?: string
  nftId?: string
  nftContract?: string
  activityTypeId?: string
  status?: string
  expiration?: FindOperator<Date>
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
  filters: Partial<T>[]
  relations: string[]
  orderBy: OrderBy
  take: number
  distinctOn?: DistinctOn<T>
}

export type FindPageableFn<T> = (query: PageableQuery<T>) => Promise<PageableResult<T>>
