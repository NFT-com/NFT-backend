import { Column, Entity, Unique } from 'typeorm'

import { BaseEntity } from './base.entity'

// this entity is to store events primarily related to profile claims

@Unique(['txHash', 'profileUrl'])
@Entity()
export class Event extends BaseEntity {
  @Column({ nullable: false })
  chainId: number

  @Column({ nullable: false })
  contract: string

  @Column({ nullable: false })
  eventName: string

  @Column({ nullable: false })
  txHash: string

  @Column({ nullable: true })
  ownerAddress: string

  @Column({ nullable: true })
  profileUrl: string

  @Column({ nullable: true })
  destinationAddress: string

  @Column({ nullable: true })
  blockNumber: number

  @Column({ default: false })
  ignore: boolean

  @Column({ default: false })
  hideIgnored: boolean

  @Column({ default: false })
  hidden: boolean

  @Column({ nullable: true })
  tokenId: string
}
