import { Column, Entity, JoinColumn, OneToOne } from 'typeorm'

import { ActivityType, ExchangeType, ProtocolType } from '@nftcom/shared/defs'

import { BaseEntity, TxActivity } from '.'

@Entity()
export class TxOrder extends BaseEntity {

  @OneToOne(() => TxActivity,
    (activity) => activity.activityTypeId,{
      nullable: false,
      cascade: ['insert', 'update'],
    })
  @JoinColumn()
  activity: TxActivity

  @Column({ type: 'enum', enum: ExchangeType, nullable: false })
  exchange: ExchangeType

  @Column({ unique: true, nullable: false }) // on-chain data will store tx hash
  orderHash: string

  @Column({ nullable: false })
  makerAddress: string

  @Column({ nullable: true })
  takerAddress: string
  
  @Column({ type: 'enum', enum: ActivityType, nullable: false })
  orderType: ActivityType

  @Column({ type: 'enum', enum: ProtocolType, nullable: false })
  protocol: ProtocolType

  @Column({ type: 'json' })
  protocolData: any

  @Column({ nullable: true })
  chainId: string

}
