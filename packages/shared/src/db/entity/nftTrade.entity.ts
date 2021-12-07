import { Column, Entity, ManyToOne } from 'typeorm'

import { BaseEntity } from './base.entity'
import { NFTRaw } from './nftRaw.entity'

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
  @Column({ nullable: true })
  contractExecution: string

  // unix timestamp for trade for fair ordering
  @Column({ nullable: true })
  blockNumber: number

  // unix timestamp for trade for fair ordering
  @Column({ nullable: true, type: 'timestamptz' })
  unixTimestamp: Date

  /**
   * @dev make sure to have info in the future about the trade itself
   * @dev e.g. make/take assets, quantity, oracle price in USD
   * @dev if NFT <> NFT exchange, use prevailing value of NFT at the previous trade
   */

  @ManyToOne(() => NFTRaw, nftRaw => nftRaw.trades)
  nftRaw: NFTRaw
    
}