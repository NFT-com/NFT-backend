import { Column, Entity, Index } from 'typeorm'

import { BaseEntity } from './base.entity'

@Entity()
@Index(['contractAddress', 'date'])
@Index(['contractAddress', 'date', 'tokenId'])
export class MarketplaceSale extends BaseEntity {
  @Column({ nullable: false })
  date: Date

  @Column({ nullable: true, type: 'numeric' })
  priceUSD: number

  @Column({ nullable: true, type: 'numeric' })
  price: number

  @Column({ nullable: false, default: '' })
  symbol: string

  @Column({ nullable: false })
  contractAddress: string

  @Column({ nullable: false })
  tokenId: string

  @Column({ type: 'json' })
  transaction: any
}
