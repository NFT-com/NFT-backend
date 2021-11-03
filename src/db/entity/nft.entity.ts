import { Column, Entity, Index } from 'typeorm'

import { NFTMetadata, NFTType } from '@src/defs/gql-types'

import { Base } from './base.entity'

@Entity()
export class NFT extends Base {

  @Column({ nullable: true })
  contract: string

  @Column({ type: 'json', nullable: false })
  metadata: NFTMetadata

  @Column({ nullable: false })
  price: number

  @Index()
  @Column({ nullable: true })
  profileId: string

  @Column({ type: 'enum', enum: NFTType, nullable: false })
  type: NFTType

  @Index()
  @Column({ nullable: false })
  userId: string

  @Index()
  @Column({ nullable: false })
  walletId: string

}
