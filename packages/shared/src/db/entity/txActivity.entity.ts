import { Column, Entity, Index } from 'typeorm'

import { BaseEntity } from '.'

@Index(['walletAddress', 'timestamp'])
@Entity()
export class TxActivity extends BaseEntity {

  @Column({ nullable: false })
  activityType: string

  @Column({ nullable: false, unique: true })
  activityTypeId: string

  @Column({ nullable: false, default: false })
  read: boolean

  @Column({ type: 'timestamptz', nullable: true })
  readTimestamp: Date

  @Column({ nullable: false })
  timestamp: Date

  @Column({ type: 'timestamptz', nullable: true })
  expiration: Date

  @Column({ nullable: false, default: 'Valid' })
  status: string

  @Column({ nullable: false, default: '0x' })
  nftContract: string

  @Column('text', { array: true })
  nftId: string[]

  @Column({ nullable: false })
  walletAddress: string

  @Column({ nullable: true })
  chainId: string

}
