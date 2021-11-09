import { Column, Entity, Index } from 'typeorm'

import { NFTMetadata, NFTType } from '@src/defs/gql'

import { BaseEntity } from './base.entity'

@Entity()
@Index(['type', 'deletedAt', 'createdAt', 'profileId'])
@Index(['userId', 'deletedAt', 'createdAt', 'type', 'profileId'])
@Index(['walletId', 'deletedAt', 'createdAt', 'type'])
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
