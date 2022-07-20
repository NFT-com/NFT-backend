import { Collection, NFT, Profile, Wallet } from '@nftcom/shared/db/entity'

export type NFTDao = NFT & {
  collection: Collection
  wallet: Wallet
}

export type ProfileDao = Profile & {
  wallet: Wallet
}