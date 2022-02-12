import { Column, Index } from 'typeorm'

import { MarketplaceAsset } from '@nftcom/shared/defs'

import { BaseEntity } from './base.entity'

export class MktAsk extends BaseEntity {

  @Column('json', {
    nullable: false,
    default: [],
  })
  currencyOptions: MarketplaceAsset[]

  @Column({ nullable: false })
  salt: string

  @Column({ nullable: false })
  makerAddress: string

  @Column({ nullable: true })
  takerAddress: string

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
  offerAcceptedAt: Date

}
