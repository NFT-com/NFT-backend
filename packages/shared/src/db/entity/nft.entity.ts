import { Column, Entity, Index, ManyToOne } from 'typeorm'

import { MarketAsk } from '@nftcom/shared/db/entity/marketAsk.entity'
import { MarketBid } from '@nftcom/shared/db/entity/marketBid.entity'
import { NFTMetadata, NFTType } from '@nftcom/shared/defs'

import { BaseEntity } from './base.entity'

// TODO recheck indexes after some data is available
@Entity()
@Index(['type', 'deletedAt', 'createdAt', 'profileId'])
@Index(['userId', 'deletedAt', 'createdAt'])
@Index(['walletId', 'deletedAt', 'createdAt'])
export class NFT extends BaseEntity {

  @Column({ nullable: true })
  contract: string

  @Column({ nullable: false })
  tokenId: number

  @Column({ type: 'json', nullable: false })
  metadata: NFTMetadata

  @Column({ nullable: true })
  price: string

  @Column({ nullable: true })
  profileId: string

  @Column({ type: 'enum', enum: NFTType, nullable: false })
  type: NFTType

  @Column({ nullable: false })
  userId: string

  @Column({ nullable: false })
  walletId: string

  @ManyToOne(() => MarketAsk, (marketAsk: MarketAsk) => marketAsk.nfts)
  marketAsk: MarketAsk

  @ManyToOne(() => MarketBid, (marketBid: MarketBid) => marketBid.nfts)
  marketBid: MarketAsk

}
