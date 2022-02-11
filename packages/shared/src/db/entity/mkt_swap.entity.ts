import { Column } from 'typeorm'

import { BaseEntity } from './base.entity'

export class MktSwap extends BaseEntity {

  @Column({ nullable: false })
  askId: string

  @Column({ nullable: true })
  bidId: string

  @Column( { nullable: false })
  txHash: string

  @Column( { nullable: false })
  blockNumber: string

  @Column( { nullable: false })
  chainId: string

}
