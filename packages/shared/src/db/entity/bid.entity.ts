import { Column, Entity, Index } from 'typeorm'

import { BidStatus, NFTType, Signature } from '@nftcom/shared/defs'

import { BaseEntity } from './base.entity'

// TODO recheck indexes after some data is available
@Entity()
@Index(['profileId', 'deletedAt', 'price'])
@Index(['profileId', 'deletedAt', 'createdAt'])
@Index(['walletId', 'deletedAt', 'createdAt'])
@Index(['userId', 'deletedAt', 'createdAt'])
export class Bid extends BaseEntity {
  @Column({ type: 'enum', enum: NFTType, nullable: false })
  nftType: NFTType

  @Column({ nullable: false })
  price: string

  @Index()
  @Column({ nullable: true })
  profileId: string

  @Column({ type: 'json', nullable: false })
  signature: Signature

  @Column({ nullable: true })
  stakeWeightedSeconds: number

  @Column({ type: 'enum', enum: BidStatus })
  status: BidStatus

  @Index()
  @Column({ nullable: false })
  userId: string

  @Index()
  @Column({ nullable: false })
  walletId: string

  @Column({ nullable: true })
  chainId: string
}
