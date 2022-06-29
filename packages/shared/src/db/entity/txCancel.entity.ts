import { Column, Entity } from 'typeorm'

import { ActivityType } from '@nftcom/shared/defs'

import { TxBaseEntity } from './txBase.entity'

@Entity()
export class TxCancel extends TxBaseEntity {
  
  @Column({ type: 'enum', enum: ActivityType, nullable: false })
  foreignType: ActivityType

  @Column({ nullable: false })
  foreignKeyId: string

  @Column({ nullable: false })
  transactionHash: string

}