import { Column, Index } from 'typeorm'

import { CurrencyType } from '@nftcom/shared/defs'

import { BaseEntity } from './base.entity'

export class MktBid extends BaseEntity {

  @Column({ type: 'json', nullable: false })
  currency: CurrencyType

  @Column({ nullable: false })
  saltNumber: string

  @Column({ nullable: false })
  bidPrice: string

  @Column({ nullable: false })
  bidNFT: string

  @Column({ nullable: false })
  address: string

  @Column('json', {
    nullable: false,
    default: [],
  })
  desiredCounterAsset: string[]

  @Column({ nullable: false })
  start: string

  @Column({ nullable: false })
  end: string

  @Index()
  @Column({ nullable: false })
  walletId: string

  @Column({ type: 'timestamp with time zone', nullable: true })
  acceptedAt: Date

  @Column({ type: 'timestamp with time zone', nullable: true })
  rejectedAt: Date

  @Column({ type: 'text', nullable: true })
  rejectedReason: string

}
