import { Column, Entity, Index } from 'typeorm'

import { NFTMetadata, NFTType } from '@src/defs/gql'

import { BaseEntity } from './base.entity'

// TODO recheck indexes after some data is available
@Entity()
@Index(['type', 'deletedAt', 'createdAt', 'profileId'])
@Index(['userId', 'deletedAt', 'createdAt'])
@Index(['walletId', 'deletedAt', 'createdAt'])
export class NFT extends BaseEntity {

  @Column({ nullable: true })
  contract: string

  @Column({ type: 'json', nullable: false })
  metadata: NFTMetadata

  @Column({ nullable: false })
  price: number

  @Column({ nullable: true })
  profileId: string

  @Column({ type: 'enum', enum: NFTType, nullable: false })
  type: NFTType

  @Column({ nullable: false })
  userId: string

  @Column({ nullable: false })
  walletId: string

}
