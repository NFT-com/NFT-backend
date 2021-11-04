import { Column, Entity, Index } from 'typeorm'

import { Signature } from '@src/defs/gql-types'

import { Base } from './base.entity'

@Entity()
export class Approval extends Base {

  @Column({ nullable: false })
  amount: number

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

}
