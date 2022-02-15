import { Column, Index } from 'typeorm'

import { MarketplaceAsset } from '@nftcom/shared/defs'

import { BaseEntity } from './base.entity'

export class MarketBid extends BaseEntity {

  @Column({ nullable: false })
  makerAddress: string

  @Index()
  @Column({ nullable: false })
  makerWalletId: string

  @Column('json', {
    nullable: false,
    default: [],
  })
  makeAsset: MarketplaceAsset[]

  @Column({ nullable: true })
  takerAddress: string

  @Column('json', {
    nullable: false,
    default: [],
  })
  takeAsset: MarketplaceAsset[]

  @Column({ type: 'text', nullable: true })
  message: string

  @Column({ nullable: false })
  start: string

  @Column({ nullable: false })
  end: string

  @Column({ nullable: false })
  salt: string

  @Column({ type: 'timestamp with time zone', nullable: true })
  acceptedAt: Date

  @Column({ type: 'timestamp with time zone', nullable: true })
  rejectedAt: Date

  @Column({ type: 'text', nullable: true })
  rejectedReason: string

  @Column( { nullable: false })
  chainId: string

}
