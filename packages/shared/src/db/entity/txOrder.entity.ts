import { Column, Entity, Index, JoinColumn, OneToOne } from 'typeorm'

import { ActivityType, ExchangeType, ProtocolType } from '@nftcom/shared/defs'

import { BaseEntity, TxActivity } from '.'

@Entity()
@Index(['makerAddress', 'exchange', 'nonce'])
export class TxOrder extends BaseEntity {

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

  @Column({ unique: true, nullable: false }) // on-chain data will store tx hash
  orderHash: string

  @Column({ type: 'enum', enum: ExchangeType, nullable: false })
  exchange: ExchangeType

  @Column({ nullable: false })
  makerAddress: string

  // @Column('json', {
  //   nullable: false,
  //   default: [],
  // })
  // makeAsset: MarketplaceAsset[]

  @Column({ nullable: true })
  takerAddress: string

  // @Column('json', {
  //   nullable: false,
  //   default: [],
  // })
  // takeAsset: MarketplaceAsset[]

  @Column({ type: 'enum', enum: ActivityType, nullable: false })
  orderType: ActivityType

  @Column({ type: 'enum', enum: ProtocolType, nullable: false })
  protocol: ProtocolType

  @Column({ type: 'json' })
  protocolData: any

  // counter is mapped to nonce for OS
  @Column({ nullable: true })
  nonce: number

  @Column({ nullable: true })
  chainId: string

  // only required for OS
  @Column({ nullable: true })
  zone: string

  @Column({ default: false })
  createdInternally: boolean

  // only required for native trading
  // @Column({ nullable: true })
  // swapTransactionId: string

  // only required for native trading
  // @Column({ nullable: true })
  // listingId: string

  // only required for native trading
  // @Column({ nullable: true })
  // buyNowTaker: string

  // only required for native trading
  // @Column({ type: 'timestamp with time zone', nullable: true })
  // acceptedAt: Date

  // only required for native trading
  // @Column({ type: 'timestamp with time zone', nullable: true })
  // rejectedAt: Date

  // only required for native trading
  @Column({ nullable: true })
  memo: string

}
