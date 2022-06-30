import { Column, Entity } from 'typeorm'

import { ActivityType } from '@nftcom/shared/defs'

import { TxBaseEntity } from './txBase.entity'

const cancelActivities = [ActivityType.Listing, ActivityType.Sale] as const
type CancelActivityType = typeof cancelActivities[number]
@Entity()
export class TxCancel extends TxBaseEntity {
  
  @Column({ type: 'enum', enum: cancelActivities, nullable: true })
  foreignType: CancelActivityType

  @Column({ nullable: false })
  foreignKeyId: string

  @Column({ nullable: false })
  transactionHash: string

}