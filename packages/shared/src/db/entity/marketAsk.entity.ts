import { Column } from 'typeorm'

import { MarketplaceAsset, Signature } from '@nftcom/shared/defs'

import { BaseEntity } from './base.entity'

export class MarketAsk extends BaseEntity {

  @Column({ nullable: false })
  structHash: string

  @Column({ type: 'json', nullable: false })
  signature: Signature

  @Column({ nullable: false })
  makerAddress: string

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
  salt: number

  @Column({ type: 'timestamp with time zone', nullable: true })
  offerAcceptedAt: Date

  @Column( { nullable: false })
  chainId: string

}
