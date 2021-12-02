import { Column, Entity, ManyToOne } from 'typeorm'

import { BaseEntity } from './base.entity'
import { NFTRaw } from './nftRaw.entity'

@Entity()
export class NFTTrade extends BaseEntity {

  // Ethereum Mainnet
  @Column({ nullable: false })
  network: string

  // for trace tracking
  @Column({ nullable: false })
  transactionHash: string

  // for tracking which exchange
  // have ENUM for opensea, rarible, etc...
  @Column({ nullable: false })
  contractExecution: string

  // unix timestamp for trade for fair ordering
  @Column({ nullable: false })
  unixTimestamp: number

  /**
   * @dev make sure to have info in the future about the trade itself
   * @dev e.g. make/take assets, quantity, oracle price in USD
   * @dev if NFT <> NFT exchange, use prevailing value of NFT at the previous trade
   */

  @ManyToOne(() => NFTRaw, nftRaw => nftRaw.trades)
  nftRaw: NFTRaw
    
}