import { Column, Entity, Index } from 'typeorm'

import { BaseEntity } from './base.entity'

@Index(['network', 'contract'])
@Index(['network', 'contract', 'tokenId', 'transactionHash'], { unique: true })
@Entity()
export class NFTTrade extends BaseEntity {

  // Ethereum Mainnet
  @Column({ nullable: false })
  network: string

  @Column({ nullable: false })
  contract: string

  // for trace tracking
  @Column({ nullable: false })
  transactionHash: string

  @Column({ nullable: false })
  from: string

  @Column({ nullable: false })
  to: string

  @Column({ nullable: false })
  tokenId: number

  // TODO add other data later like USD value of swap

  // for tracking which exchange
  // have ENUM for opensea, rarible, etc...
  // TODO delete later because not necessary
  @Column({ nullable: true })
  contractExecution: string

  // unix timestamp for trade for fair ordering
  @Column({ nullable: true })
  blockNumber: number

  // unix timestamp for trade for fair ordering
  @Column({ nullable: true, type: 'timestamptz' })
  unixTimestamp: Date
    
}