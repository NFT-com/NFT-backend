import { Column, Entity, Index } from 'typeorm'

import { ActivityType } from '@nftcom/shared/defs'

import { BaseEntity } from './base.entity'

@Index(['userId', 'timestamp'], { unique: true })
@Entity()
export class TxActivity extends BaseEntity {

  @Column({ type: 'enum', enum: ActivityType, nullable: false })
  foreignType: ActivityType

  @Column({ nullable: false })
  foreignKeyId: string

  @Column({ nullable: false, default: false })
  read: boolean

  @Column({ nullable: false })
  timestamp: Date

  @Column({ nullable: false })
  userId: string

}
