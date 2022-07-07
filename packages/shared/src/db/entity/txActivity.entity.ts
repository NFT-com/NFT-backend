import { Column, Entity, Index } from 'typeorm'

import { ActivityType } from '@nftcom/shared/defs'

import { BaseEntity } from '.'

@Index(['userId', 'timestamp'], { unique: true })
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
  userId: string

}
