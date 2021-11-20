import { db, defs, entity } from '@nftcom/shared'

import { PageInfo } from './gql'

export type Pageable<T> = {
  items: T[]
  pageInfo: PageInfo
  totalItems: number
}

export type Context = {
  chain: defs.Chain
  network: string
  repositories: db.Repository
  user: entity.User
  wallet: entity.Wallet
}
