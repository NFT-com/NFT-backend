import { Column, Entity, Index } from 'typeorm'

import { ActivityType } from '@nftcom/shared/defs'

import { BaseEntity } from '.'

@Index(['walletId', 'timestamp']) // discuss about unique fields and indices during data modelling
@Entity()
export class TxActivity extends BaseEntity {

  @Column({ type: 'enum', enum: ActivityType, nullable: false })
  activityType: ActivityType

  @Column({ nullable: false })
  activityTypeId: string

  @Column({ nullable: false, default: false })
  read: boolean

  @Column({ nullable: false })
  timestamp: Date

  @Column({ nullable: false })
  walletId: string

  @Column({ nullable: true })
  chainId: string

}
