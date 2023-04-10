import { Column, Entity, Index, OneToMany, Unique } from 'typeorm'

import { NFTMetadata, NFTType } from '@nftcom/shared/defs'

import { BaseEntity } from './base.entity'
import { NFTOwner } from './nftOwner.entity'

// TODO recheck indexes after some data is available
@Entity()
@Index(['type', 'deletedAt', 'createdAt'])
@Index(['userId', 'deletedAt', 'createdAt'])
@Index(['walletId', 'deletedAt', 'createdAt'])
@Index(['contract', 'deletedAt', 'createdAt'])
@Unique(['contract', 'tokenId', 'chainId'])
export class NFT extends BaseEntity {
  @Column({ nullable: true })
  contract: string

  @Column({ nullable: false })
  tokenId: string

  @Column({ type: 'json', nullable: false })
  metadata: NFTMetadata

  @Column({ nullable: true })
  price: string

  @Column({ type: 'enum', enum: NFTType, nullable: false })
  type: NFTType

  @Column({ nullable: true })
  userId: string

  @Column({ nullable: true })
  walletId: string

  @Column({ nullable: true })
  chainId: string

  @Column({ type: 'varchar', nullable: true, length: 2000 })
  memo: string

  @Column({ nullable: true })
  profileId: string

  @Column({ nullable: true })
  previewLink: string

  @Column({ type: 'varchar', nullable: true, length: 2000 })
  previewLinkError: string

  @Column({ nullable: true, type: 'timestamp with time zone' })
  lastRefreshed: Date

  @Column({ nullable: true })
  rarity: string

  @Column({ nullable: true })
  uriString: string

  @Column({ nullable: true })
  owner: string

  @OneToMany(() => NFTOwner, nftOwner => nftOwner.nft)
  nftOwners: NFTOwner[]
}
