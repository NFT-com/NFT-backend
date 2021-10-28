import * as repo from './repository'

export * as db from './connect'
export * as entity from './entity'

export type Repository = {
  user: repo.UserRepository
}

export type Context = {
  chainId: string
  address: string
  repository: Repository
}

export const repository: Repository = {
  user: new repo.UserRepository(),
}
