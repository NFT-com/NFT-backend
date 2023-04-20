import { Column, Entity, Index } from 'typeorm'

import { Signature } from '../../defs'
import { BaseEntity } from './base.entity'

@Entity()
export class Approval extends BaseEntity {
  @Column({ nullable: false })
  amount: string

  @Column({ nullable: false })
  currency: string

  @Column({ nullable: false })
  deadline: string

  @Column({ nullable: false })
  nonce: number

  @Column({ type: 'json' })
  signature: Signature

  @Column({ nullable: false })
  txHash: string

  @Index()
  @Column({ nullable: false })
  userId: string

  @Index()
  @Column({ nullable: false })
  walletId: string

  @Column({ nullable: false })
  spender: string
}
