import { Collection, NFT, Wallet } from '@nftcom/shared/db/entity'

export type NFTDao = NFT & {
  collection: Collection
  wallet: Wallet
}