import { Column, Entity } from 'typeorm'

import { defs } from '@nftcom/shared'

import { BaseEntity } from './base.entity'
@Entity()
export class MarketAsk extends BaseEntity {

  @Column({ nullable: false })
  structHash: string

  @Column({ type: 'json', nullable: false })
  signature: defs.Signature

  @Column({ nullable: false })
  makerAddress: string

  @Column('json', {
    nullable: false,
    default: [],
  })
  makeAsset: defs.MarketplaceAsset[]

  @Column({ nullable: false })
  takerAddress: string

  @Column('json', {
    nullable: false,
    default: [],
  })
  takeAsset: defs.MarketplaceAsset[]

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
