import { Column, Entity } from 'typeorm'

import { MarketplaceAsset, Signature } from '@nftcom/shared/defs'

import { BaseEntity } from './base.entity'

@Entity()
export class MarketBid extends BaseEntity {

  @Column({ nullable: false })
  structHash: string

  @Column({ type: 'json', nullable: false })
  signature: Signature

  @Column( { nullable: false })
  nonce: number

  @Column({ nullable: false })
  marketAskId: string

  @Column({ nullable: false })
  makerAddress: string

  @Column('json', {
    nullable: false,
    default: [],
  })
  makeAsset: MarketplaceAsset[]

  @Column({ nullable: false })
  takerAddress: string

  @Column('json', {
    nullable: false,
    default: [],
  })
  takeAsset: MarketplaceAsset[]

  @Column({ nullable: true })
  approvalTxHash: string

  @Column({ nullable: true })
  cancelTxHash: string

  @Column({ type: 'text', nullable: false })
  message: string

  @Column({ nullable: false })
  start: string

  @Column({ nullable: false })
  end: string

  @Column({ nullable: false })
  salt: number

  @Column({ type: 'timestamp with time zone', nullable: true })
  acceptedAt: Date

  @Column({ type: 'timestamp with time zone', nullable: true })
  rejectedAt: Date

  @Column({ type: 'text', nullable: true })
  rejectedReason: string

  @Column( { nullable: false })
  chainId: string

}
