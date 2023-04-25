import { Column, Entity, JoinColumn, OneToOne } from 'typeorm'

import { MarketAsk } from '../entity/marketAsk.entity'
import { MarketBid } from '../entity/marketBid.entity'
import { BaseEntity } from './base.entity'

@Entity()
export class MarketSwap extends BaseEntity {
  @Column({ nullable: false })
  txHash: string

  @Column({ nullable: false })
  blockNumber: string

  @Column({ type: 'boolean', default: false })
  private: boolean

  @OneToOne(() => MarketAsk)
  @JoinColumn()
  marketAsk: MarketAsk

  @OneToOne(() => MarketBid)
  @JoinColumn()
  marketBid: MarketBid
}
