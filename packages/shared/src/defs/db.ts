import { EntityFieldsNames } from 'typeorm/common/EntityFieldsNames'

export enum EntityType {
  Approval = 'Approval',
  Bid = 'Bid',
  Edge = 'Edge',
  NFT = 'NFT',
  Profile = 'Profile',
  User = 'User',
  Wallet = 'Wallet'
}

export enum EdgeType {
  Follows = 'Follows',
  Referred = 'Referred'
}

export enum BidStatus {
  Executed = 'Executed',
  Submitted = 'Submitted'
}

export enum NFTType {
  ERC721 = 'ERC721',
  ERC1155 = 'ERC1155',
  Profile = 'Profile'
}

export type NFTMetadata = {
  tokenId: string
  name: string
  description: string
  imageURL: string
  txHash: string
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

export type OrderBy<T> = { [P in EntityFieldsNames<T>]?: 'ASC' | 'DESC' | 1 | -1 }

export type DBConfig = {
  host: string
  port: number
  user: string
  password: string
  database: string
  logging: boolean
  migrationDirectory: string
  useSSL: boolean
}
