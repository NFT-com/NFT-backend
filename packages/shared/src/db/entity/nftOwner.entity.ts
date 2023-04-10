import { Column, Entity, ManyToOne } from 'typeorm'

import { BaseEntity } from './base.entity'
import { NFT } from './nft.entity'
import { Wallet } from './wallet.entity'

@Entity({ name: 'nft_owner' })
export class NFTOwner extends BaseEntity {
  // track balance for ERC-1155s
  @Column()
  balance: number

  @ManyToOne(() => NFT, nft => nft.nftOwners)
  nft: NFT

  @ManyToOne(() => Wallet, wallet => wallet.nftOwners)
  wallet: Wallet
}
