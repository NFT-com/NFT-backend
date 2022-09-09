import { Column, Entity } from 'typeorm'

import { BaseEntity } from './base.entity'

@Entity()
export class MarketplaceSale extends BaseEntity {

  @Column( { nullable: false })
  date: Date

  @Column( { nullable: false, type: 'numeric' })
  priceUSD: number

  @Column( { nullable: false })
  contractAddress: string

  @Column( { nullable: false })
  tokenId: string

  @Column({ type: 'json' })
  transaction: any

}
