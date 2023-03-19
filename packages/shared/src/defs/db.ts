import { FindOperator, FindOptionsSelect } from 'typeorm'

import { gql } from '@nftcom/gql/defs'
import { repository } from '@nftcom/shared'

import { BaseEntity, Collection, NFT } from '../db/entity'

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
  CRYPTO_PUNKS = 'CRYPTO_PUNKS',
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
  Swap = 'Swap',
}

export enum ActivityHL {
  Highest = 'highest',
  Lowest = 'lowest'
}

export enum ActivityStatus {
  Valid = 'Valid',
  Cancelled = 'Cancelled',
  Executed = 'Executed'
}

export enum ExchangeType {
  OpenSea = 'OpenSea',
  LooksRare = 'LooksRare',
  X2Y2 = 'X2Y2',
  NFTCOM = 'NFTCOM',
}

export enum ProtocolType {
  Seaport = 'Seaport',
  LooksRare = 'LooksRare',
  X2Y2 = 'X2Y2',
  NFTCOM = 'NFTCOM'
}

export type NFTPortNFTType = {
  contractType: string
  contractAddress: string
  tokenId: string
}

export type NFTPortPriceType = {
  assetType: string
  contractAddress: string
  price: string
  priceUSD: string
}

export enum NFTPortMarketplace {
  OpenSea = 'OpenSea',
  LooksRare = 'LooksRare',
  X2Y2 = 'X2Y2',
  Rarible = 'Rarible',
  Cryptopunks = 'Cryptopunks',
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
  rarity?: string
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

export enum ProfileTask {
  CREATE_NFT_PROFILE = 'CREATE_NFT_PROFILE',
  CUSTOMIZE_PROFILE = 'CUSTOMIZE_PROFILE',
  REFER_NETWORK = 'REFER_NETWORK',
  BUY_NFTS = 'BUY_NFTS',
  LIST_NFTS = 'LIST_NFTS',
  ISSUE_NFTS = 'ISSUE_NFTS',
}

export enum ProfileTaskPoint {
  CREATE_NFT_PROFILE = 5,
  CUSTOMIZE_PROFILE = 1,
  REFER_NETWORK = 2,
  BUY_NFTS = 1,
  LIST_NFTS = 2,
  ISSUE_NFTS = 5,
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

export type OrderBy = { [x: string]: 'ASC' | 'DESC' | { order: 'ASC' | 'DESC'; nulls?: 'NULLS FIRST' | 'NULLS LAST' } }

export type OrderKey<T> = (keyof T extends string ? keyof T : keyof BaseEntity) | 'createdAt'

export type PaginatedResultsFromEntityByArgs<T> = {
  repo: repository.BaseRepository<T>
  pageInput: gql.PageInput
  filters: Partial<T>[]
  relations: string[]
  orderKey: OrderKey<T>
  orderDirection: 'ASC' | 'DESC'
  select?: FindOptionsSelect<Partial<T>>
}

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

export type ProfileSearchNFT = NFT & {
  collection: Collection
  isHide: boolean
  sortIndex: number
}

/**
 * Special options passed to Repository#upsert
 */
export interface UpsertOptions {
  conflictPaths: string[]
  skipUpdateIfNoValuesChanged?: boolean
}
