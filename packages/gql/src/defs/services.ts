import { db } from '@nftcom/shared'

export type GetCollectionInfoByContract = {
  contract: string
  chainId: string
  repositories: db.Repository
}

export type GetCollectionInfoBySlug = {
  chainId: string
  slug: string
  repositories: db.Repository
}

export type GetCollectionInfoArgs = GetCollectionInfoByContract | GetCollectionInfoBySlug
