import { misc } from '@src/defs'

import * as entity from './entity'
import * as repo from './repository'

export * as db from './connect'
export * as entity from './entity'
export * as repository from './repository'

export type Repository = {
  approval: repo.ApprovalRepository
  bid: repo.BidRepository
  edge: repo.EdgeRepository
  nft: repo.NFTRepository
  profile: repo.ProfileRepository
  user: repo.UserRepository
  wallet: repo.WalletRepository
}

export type Context = {
  network: string
  chain: misc.Chain
  user: entity.User
  wallet: entity.Wallet
  repositories: Repository
}

export const newRepositories = (): Repository => ({
  approval: new repo.ApprovalRepository(),
  bid: new repo.BidRepository(),
  edge: new repo.EdgeRepository(),
  nft: new repo.NFTRepository(),
  profile: new repo.ProfileRepository(),
  user: new repo.UserRepository(),
  wallet: new repo.WalletRepository(),
})

export type AnyEntity = entity.Approval | entity.Bid | entity.Edge
| entity.NFT | entity.Profile | entity.User | entity.Wallet
