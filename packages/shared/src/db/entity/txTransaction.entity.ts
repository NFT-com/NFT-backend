import { Column, Entity, Index, JoinColumn, OneToOne } from 'typeorm'

import { ActivityType, ExchangeType, ProtocolType } from '../../defs'

import { BaseEntity, TxActivity } from '.'

@Index(['taker'])
@Entity()
export class TxTransaction extends BaseEntity {
  @OneToOne(() => TxActivity, activity => activity.activityTypeId, {
    nullable: false,
    cascade: ['insert', 'update'],
  })
  @JoinColumn({
    name: 'activityId',
    referencedColumnName: 'id',
  })
  activity: TxActivity

  @Column({ type: 'enum', enum: ExchangeType, nullable: false })
  exchange: ExchangeType

  @Column({ type: 'enum', enum: ActivityType, nullable: false })
  transactionType: ActivityType

  @Column({ type: 'enum', enum: ProtocolType, nullable: false })
  protocol: ProtocolType

  @Column({ type: 'json' })
  protocolData: any

  @Column({ unique: true, nullable: false })
  transactionHash: string

  @Column({ nullable: false })
  blockNumber: string

  @Column({ nullable: true })
  nftContractAddress: string

  @Column({ nullable: true })
  nftContractTokenId: string

  @Column({ nullable: false, default: 'Default' })
  eventType: string

  @Column({ nullable: false })
  maker: string

  @Column({ nullable: false })
  taker: string

  @Column({ nullable: true })
  chainId: string
}
