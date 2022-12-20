import { Column, Entity, JoinColumn, OneToOne } from 'typeorm'

import { BaseEntity,TxActivity } from '.'

@Entity()
export class TxTransaction extends BaseEntity {

  @OneToOne(() => TxActivity,
    (activity) =>  activity.activityTypeId,
    {
      nullable: false,
      cascade: ['insert', 'update'],
    },
  )
  @JoinColumn({
    name: 'activityId',
    referencedColumnName: 'id',
  })
  activity: TxActivity

  @Column({ nullable: false })
  exchange: string

  @Column({ nullable: false })
  transactionType: string

  @Column({ nullable: false })
  protocol: string

  @Column({ type: 'json' })
  protocolData: any

  @Column({ unique: true, nullable: false })
  transactionHash: string

  @Column({ nullable: false })
  blockNumber: string

  @Column({ nullable: true })
  nftContractAddress: string

  @Column({ nullable: true })
  nftContractTokenId: string

  @Column({ nullable: false, default: 'Default' })
  eventType: string

  @Column({ nullable: false })
  maker: string

  @Column({ nullable: false })
  taker: string

  @Column({ nullable: true })
  chainId: string

  @Column({ nullable: true })
  listingOrderId: string

  @Column({ nullable: true })
  bidOrderId: string

}
