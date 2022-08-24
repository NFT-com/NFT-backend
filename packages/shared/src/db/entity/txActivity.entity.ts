import { Column, Entity, Index } from 'typeorm'

import { ActivityType } from '@nftcom/shared/defs'

import { BaseEntity } from '.'

@Index(['walletAddress', 'timestamp'])
@Entity()
export class TxActivity extends BaseEntity {

  @Column({ type: 'enum', enum: ActivityType, nullable: false })
  activityType: ActivityType

  @Column({ nullable: false, unique: true })
  activityTypeId: string

  @Column({ nullable: false, default: false })
  read: boolean

  @Column({ nullable: false })
  timestamp: Date

  @Column('text', { array: true })
  nftId: string[]

  @Column({ nullable: false })
  walletAddress: string

  @Column({ nullable: true })
  chainId: string

}
