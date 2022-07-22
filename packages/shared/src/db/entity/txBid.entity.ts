import { Column, Entity, JoinColumn, OneToOne } from 'typeorm'

import { ExchangeType } from '@nftcom/shared/defs'

import { BaseEntity, TxActivity } from '.'

@Entity()
export class TxBid extends BaseEntity {

  // @TODO: Need to re-configure cascade during data modelling
  @OneToOne(() => TxActivity,
    (activity) => activity.activityTypeId,{
      nullable: false,
      cascade: true,
    })  @JoinColumn()
  activity: TxActivity

  @Column({ type: 'enum', enum: ExchangeType, nullable: false })
  exchange: ExchangeType

  @Column({ nullable: false })
  orderHash: string

  @Column({ nullable: false })
  makerAddress: string

  @Column({ nullable: true })
  takerAddress: string

  // null for Wyvern
  @Column('json', { nullable: true })
  offer: any[]
  // null for Wyvern
  @Column('json', { nullable: true })
  consideration: any[]

  @Column({ nullable: true })
  chainId: string

}
