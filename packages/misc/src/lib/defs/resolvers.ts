import DataLoader from 'dataloader'
import { FindOneOptions, FindOptionsSelect } from 'typeorm'

import { db, defs, entity, repository } from '@nftcom/shared'
import { OrderKey } from '@nftcom/shared/src/defs'

import { pagination } from '../helper'

export type Context = {
  chain: defs.Chain
  network: string
  repositories: db.Repository
  user: entity.User
  wallet: entity.Wallet
  teamKey?: string
  xMintSignature?: string
  loaders: { [k: string]: DataLoader<any, any, any> }
}

export type Pageable<T> = {
  items: T[]
  pageInfo: pagination.PageInfo
  totalItems: number
}

export type OffsetPageable<T> = {
  items: T[]
  pageCount: number
  totalItems: number
}

export type PaginatedResultsFromEntityByArgs<T> = {
  repo: repository.BaseRepository<T>
  pageInput: pagination.PageInput
  filters?: Partial<T>[]
  relations: string[]
  orderKey: OrderKey<T>
  orderDirection: 'ASC' | 'DESC'
  select?: FindOptionsSelect<Partial<T>>
}

export type PaginatedOffsetResultsFromEntityByArgs<T> = Omit<
  PaginatedResultsFromEntityByArgs<T>,
  'pageInput' | 'relations'
> &
  Pick<FindOneOptions<T>, 'cache'> & {
    offsetPageInput: pagination.OffsetPageInput
    relations?: string[]
  }

export type ToOffsetPageableArgs<T> = {
  offsetPageInput: pagination.OffsetPageInput
  result: defs.PageableResult<T>
}
