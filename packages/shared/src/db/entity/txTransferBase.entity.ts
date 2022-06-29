import { Column, Entity } from 'typeorm'

import { BaseEntity } from './base.entity'

@Entity()
export class TxTransferBaseEntity extends BaseEntity {
  
  @Column({ nullable: false })
  transactionHash: string

  @Column({ nullable: false })
  blockNumber: string

  @Column({ nullable: false })
  nftContractAddress: string

  @Column({ nullable: false })
  nftContractTokenId: string

  @Column({ nullable: false })
  sender: string

  @Column({ nullable: false })
  receiver: string

}