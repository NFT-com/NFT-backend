import { Column, Entity } from 'typeorm'

import { BaseEntity } from './base.entity'

@Entity()
export class MarketSwap extends BaseEntity {

  @Column({ nullable: false })
  askId: string

  @Column({ nullable: true })
  bidId: string

  @Column( { nullable: false })
  txHash: string

  @Column( { nullable: false })
  blockNumber: string

  @Column( { type: 'boolean', default: false })
  private: boolean

}
