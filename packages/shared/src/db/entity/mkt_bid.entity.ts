import { Column, Index } from 'typeorm'

import { MarketplaceAsset } from '@nftcom/shared/defs'

import { BaseEntity } from './base.entity'

export class MktBid extends BaseEntity {

  @Column('json', {
    nullable: false,
    default: [],
  })
  currency: MarketplaceAsset[]

  @Column({ nullable: false })
  salt: string

  @Column({ nullable: false })
  bidPrice: string

  @Column({ nullable: false })
  bidNFT: string

  @Column({ nullable: false })
  makerAddress: string

  @Column('json', {
    nullable: false,
    default: [],
  })
  desiredCounterAsset: MarketplaceAsset[]

  @Column({ nullable: false })
  start: string

  @Column({ nullable: false })
  end: string

  @Index()
  @Column({ nullable: false })
  makerWalletId: string

  @Column({ type: 'timestamp with time zone', nullable: true })
  acceptedAt: Date

  @Column({ type: 'timestamp with time zone', nullable: true })
  rejectedAt: Date

  @Column({ type: 'text', nullable: true })
  rejectedReason: string

}
