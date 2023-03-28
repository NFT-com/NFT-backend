import { db } from '@nftcom/shared'

export type GetCollectionInfoByContract = {
  contract: string
  chainId: string
  repositories: db.Repository
}

export type GetCollectionInfoByName = {
  chainId: string
  name: string
  repositories: db.Repository
}

export type GetCollectionInfoArgs = GetCollectionInfoByContract | GetCollectionInfoByName
