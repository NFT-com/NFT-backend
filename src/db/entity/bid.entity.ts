import { Column, Entity, Index } from 'typeorm'

import { BidStatus, NFTType, Signature } from '@src/defs/gql'

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
  price: number

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

}
