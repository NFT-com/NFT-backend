import { Column } from 'typeorm'

import { MarketplaceAsset } from '@nftcom/shared/defs'

import { BaseEntity } from './base.entity'

export class MarketAsk extends BaseEntity {

  @Column({ nullable: false })
  makerAddress: string

  // @Index()
  // @Column({ nullable: false })
  // makerWalletId: string

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

  @Column({ nullable: false })
  start: string

  @Column({ nullable: false })
  end: string

  @Column({ nullable: false })
  salt: string

  @Column({ type: 'timestamp with time zone', nullable: true })
  offerAcceptedAt: Date

  @Column( { nullable: false })
  chainId: string

}
