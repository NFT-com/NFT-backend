import { Column, Entity, JoinColumn, OneToOne } from 'typeorm'

import { ActivityType, ExchangeType } from '@nftcom/shared/defs'

import { BaseEntity,TxActivity } from '.'

@Entity()
export class TxTransaction extends BaseEntity {

  @OneToOne(() => TxActivity,
    {
      nullable: false,
      cascade: ['insert', 'update'],
    },
  )
  @JoinColumn()
  activity: TxActivity

  @Column({ type: 'enum', enum: ExchangeType, nullable: false })
  exchange: ExchangeType

  @Column({ type: 'enum', enum: ActivityType, nullable: false })
  transactionType: ActivityType

  @Column({ nullable: false })
  price: string

  @Column({ nullable: false })
  currencyAddress: string

  @Column({ nullable: false })
  transactionHash: string

  @Column({ nullable: false })
  blockNumber: string

  @Column({ nullable: false })
  nftContractAddress: string

  @Column({ nullable: false })
  nftContractTokenId: string

  @Column({ nullable: false, default: 'Default' })
  eventType: string

  @Column({ nullable: false })
  maker: string

  @Column({ nullable: false })
  taker: string

  @Column({ nullable: true })
  chainId: string

}
