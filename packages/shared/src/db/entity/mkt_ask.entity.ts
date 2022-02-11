import { Column, Index } from 'typeorm'

import { CurrencyType } from '@nftcom/shared/defs'

import { BaseEntity } from './base.entity'

export class MktAsk extends BaseEntity {

  @Column('json', {
    nullable: false,
    default: [],
  })
  currencyOptions: CurrencyType[]

  @Column({ nullable: false })
  saltNumber: string

  @Column({ nullable: false })
  minAskPrice: string

  @Column({ nullable: false })
  address: string

  @Column({ nullable: true })
  optionalRecipient: string

  @Column('json', {
    nullable: false,
    default: [],
  })
  desiredCounterAsset: string[]

  @Column({ nullable: false })
  start: string

  @Column({ nullable: false })
  end: string

  @Column({ nullable: false })
  buyNowPrice: string

  @Index()
  @Column({ nullable: false })
  walletId: string

  @Column({ type: 'timestamp with time zone', nullable: true })
  offerAcceptedAt: Date

}
