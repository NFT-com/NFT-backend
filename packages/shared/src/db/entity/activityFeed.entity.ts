import { Column, Entity } from 'typeorm'

import { BaseEntity } from './base.entity'

export enum ActivityFeedERCType {
  ERC721 = 'ERC721',
  ERC1155 = 'ERC1155',
}

export enum ActivityFeedTradeType {
  SALE = 'SALE',
  MINT = 'MINT',
}

export enum ActivityFeedCurrency {
  ETH = 'ETH',
  WETH = 'WETH',
  BLUR_POOL = 'BLUR_POOL',
}

@Entity()
export class ActivityFeed extends BaseEntity {

  @Column()
  txHash: string

  @Column()
  collectionAddress: string

  @Column({ nullable: true })
  collectionName: string

  @Column()
  tokenId: string

  @Column({ type: 'enum', enum: ActivityFeedERCType })
  ercType: ActivityFeedERCType

  @Column({ nullable: true })
  tokenURI: string

  @Column({ nullable: true })
  imageURI: string

  @Column({ nullable: true })
  marketplaceName: string

  @Column({ nullable: true })
  marketplaceAddress: string

  @Column()
  buyerAddress: string

  @Column()
  sellerAddress: string

  @Column()
  timestamp: string

  @Column({ type: 'enum', enum: ActivityFeedTradeType })
  tradeType: ActivityFeedTradeType

  @Column({ nullable: true })
  txWeiValue: string

  @Column({ nullable: true, type: 'enum', enum: ActivityFeedCurrency })
  txCurrency: ActivityFeedCurrency

  @Column({ nullable: true })
  txValue: string

}
