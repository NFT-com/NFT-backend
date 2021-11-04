import { Column, Entity, Index } from 'typeorm'

import { BidStatus, NFTType, Signature } from '@src/defs/gql'

import { Base } from './base.entity'

@Entity()
export class Bid extends Base {

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
