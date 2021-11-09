import { Column, Entity, Index } from 'typeorm'

import { BidStatus, NFTType, Signature } from '@src/defs/gql'

import { BaseEntity } from './base.entity'

@Entity()
@Index(['profileId', 'deletedAt', 'price'])
@Index(['profileId', 'deletedAt', 'createdAt', 'walletId'])
@Index(['walletId', 'deletedAt', 'createdAt'])
@Index(['userId', 'deletedAt', 'createdAt', 'profileId'])
export class Bid extends BaseEntity {

  @Column({ type: 'enum', enum: NFTType, nullable: false })
  nftType: NFTType

  @Index()
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
