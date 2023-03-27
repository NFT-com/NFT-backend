import { db } from '@nftcom/shared'

export type GetCollectionInfoByContact = {
  contract: string
  chainId: string
  repositories: db.Repository
}

export type GetCollectionInfoByName = {
  chainId: string
  name: string
  repositories: db.Repository
}

export type GetCollectionInfoArgs = GetCollectionInfoByContact | GetCollectionInfoByName
