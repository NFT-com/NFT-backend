import { Column, Entity, Index } from 'typeorm'

import { ActivityStatus, ActivityType } from '../../defs'

import { BaseEntity } from '.'

@Index(['walletAddress', 'timestamp'])
@Index(['activityType', 'status', 'expiration', 'chainId'])
@Entity()
export class TxActivity extends BaseEntity {
  @Column({ type: 'enum', enum: ActivityType, nullable: false })
  activityType: ActivityType

  @Column({ nullable: false, unique: true })
  activityTypeId: string

  @Column({ nullable: false, default: false })
  read: boolean

  @Column({ type: 'timestamptz', nullable: true })
  readTimestamp: Date

  @Column({ nullable: false })
  timestamp: Date

  @Index()
  @Column({ type: 'timestamptz', nullable: true })
  expiration: Date

  @Column({ type: 'enum', enum: ActivityStatus, nullable: false, default: ActivityStatus.Valid })
  status: ActivityStatus

  @Index()
  @Column({ nullable: false, default: '0x' })
  nftContract: string

  /*
   *  @Index() -- Manually added to migration 1673014408233-txActivityNftIdExpirationIndexes.ts
   *  because Typeorm does not support GIN index required for array types
   */
  @Column('text', { array: true })
  nftId: string[]

  @Column({ nullable: false })
  walletAddress: string

  @Column({ nullable: true })
  chainId: string
}
