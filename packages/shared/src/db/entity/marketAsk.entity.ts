import { Column, Entity } from 'typeorm'

import { AuctionType, MarketplaceAsset, Signature } from '@nftcom/shared/defs'

import { BaseEntity } from './base.entity'

@Entity()
export class MarketAsk extends BaseEntity {
  @Column({ nullable: false })
  structHash: string

  @Column({ nullable: false })
  nonce: number

  @Column({
    type: 'enum',
    enum: AuctionType,
    nullable: false,
  })
  auctionType: AuctionType

  @Column({ type: 'json', nullable: false })
  signature: Signature

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
  buyNowTaker: string

  @Column({ nullable: true })
  marketSwapId: string

  @Column({ nullable: true })
  approvalTxHash: string

  @Column({ nullable: true })
  cancelTxHash: string

  @Column({ nullable: false })
  start: number

  @Column({ nullable: false })
  end: number

  @Column({ nullable: false })
  salt: number

  @Column({ type: 'timestamp with time zone', nullable: true })
  offerAcceptedAt: Date

  @Column({ nullable: false })
  chainId: string
}
