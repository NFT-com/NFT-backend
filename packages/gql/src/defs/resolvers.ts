import DataLoader from 'dataloader'
import { FindOneOptions, FindOptionsSelect } from 'typeorm'

import { gql } from '@nftcom/gql/defs'
import { db, defs, entity, repository } from '@nftcom/shared'
import { OrderKey } from '@nftcom/shared/src/defs'

import { PageInfo } from './gql'

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
  pageInfo: PageInfo
  totalItems: number
}

export type OffsetPageable<T> = {
  items: T[]
  pageCount: number
  totalItems: number
}

export type PaginatedResultsFromEntityByArgs<T> = {
  repo: repository.BaseRepository<T>
  pageInput: gql.PageInput
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
    offsetPageInput: gql.OffsetPageInput
    relations?: string[]
  }

export type ToOffsetPageableArgs<T> = {
  offsetPageInput: gql.OffsetPageInput
  result: defs.PageableResult<T>
}
