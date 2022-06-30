import { Column,Entity, Index,JoinColumn, OneToOne } from 'typeorm'

import { ActivityType } from '@nftcom/shared/defs'

import { BaseEntity, TxBid, TxCancel, TxList, TxSale, TxTransfer } from './'

@Index(['userId', 'timestamp'], { unique: true })
@Entity()
export class TxActivity extends BaseEntity {

  @Column({ type: 'enum', enum: ActivityType, nullable: false })
  foreignType: ActivityType

  @OneToOne(() => TxBid)
  @JoinColumn()
  bid: TxBid

  @OneToOne(() => TxCancel)
  @JoinColumn()
  cancel: TxCancel

  @OneToOne(() => TxList)
  @JoinColumn()
  listing: TxList

  @OneToOne(() => TxSale)
  @JoinColumn()
  sale: TxSale

  @OneToOne(() => TxTransfer)
  @JoinColumn()
  transfer: TxTransfer

  @Column({ nullable: false, default: false })
  read: boolean

  @Column({ nullable: false })
  timestamp: Date

  @Column({ nullable: false })
  userId: string

}
