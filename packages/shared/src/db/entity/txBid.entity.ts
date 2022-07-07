import { Column, Entity, JoinColumn, OneToOne } from 'typeorm'

import { ExchangeType } from '@nftcom/shared/defs'

import { BaseEntity, TxActivity } from '.'

@Entity()
export class TxBid extends BaseEntity {

  @OneToOne(() => TxActivity, (activity) => activity.activityTypeId, { nullable: false })
  @JoinColumn()
  activity: TxActivity

  @Column({ type: 'enum', enum: ExchangeType, nullable: false })
  exchange: ExchangeType

  @Column({ nullable: false })
  orderHash: string

  @Column({ nullable: false })
  makerAddress: string

  @Column({ nullable: true })
  takerAddress: string

  @Column('json', { nullable: false })
  offer: any[]

  @Column('json', { nullable: false })
  consideration: any[]

}
