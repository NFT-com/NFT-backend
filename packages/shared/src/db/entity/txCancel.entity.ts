import { Column, Entity, JoinColumn, OneToOne } from 'typeorm'

import { CancelActivities, CancelActivityType } from '@nftcom/shared/defs'

import { BaseEntity, TxActivity } from '.'

@Entity()
export class TxCancel extends BaseEntity {

  @OneToOne(() => TxActivity,
    (activity) =>  activity.activityTypeId,
    {
      nullable: false,
      cascade: ['insert', 'update'],
    },
  )
  @JoinColumn({
    name: 'activityId',
    referencedColumnName: 'id',
  })
  activity: TxActivity

  @Column({  nullable: false })
  exchange: string

  @Column({ type: 'enum', enum: CancelActivities, nullable: true })
  foreignType: CancelActivityType

  @Column({ nullable: false })
  foreignKeyId: string

  @Column({ nullable: false })
  transactionHash: string

  @Column({ nullable: false, default: '0' })
  blockNumber: string

  @Column({ nullable: true })
  chainId: string

}
