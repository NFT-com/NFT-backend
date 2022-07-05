import { Column, Entity, JoinColumn, OneToOne } from 'typeorm'

import { BaseEntity, TxActivity } from '.'

@Entity()
export class TxTransfer extends BaseEntity {

  @OneToOne(() => TxActivity, (activity) => activity.activityTypeId, { nullable: false })
  @JoinColumn()
  activity: TxActivity

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