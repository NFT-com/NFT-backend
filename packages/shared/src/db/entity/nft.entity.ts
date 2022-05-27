import { Column, Entity, Index } from 'typeorm'

import { NFTMetadata, NFTType } from '@nftcom/shared/defs'

import { BaseEntity } from './base.entity'

// TODO recheck indexes after some data is available
@Entity()
@Index(['type', 'deletedAt', 'createdAt'])
@Index(['userId', 'deletedAt', 'createdAt'])
@Index(['walletId', 'deletedAt', 'createdAt'])
@Index(['contract', 'deletedAt', 'createdAt'])
export class NFT extends BaseEntity {

  @Column({ nullable: true })
  contract: string

  @Column({ nullable: false })
  tokenId: string

  @Column({ type: 'json', nullable: false })
  metadata: NFTMetadata

  @Column({ nullable: true })
  price: string

  @Column({ type: 'enum', enum: NFTType, nullable: false })
  type: NFTType

  @Column({ nullable: false })
  userId: string

  @Column({ nullable: false })
  walletId: string

}
