import { Column, Entity, Index, Unique } from 'typeorm'

import { BaseEntity } from './base.entity'

@Entity()
@Index(['contract'])
@Unique(['contract', 'chainId'])
export class Collection extends BaseEntity {
  @Column({ nullable: false })
  contract: string

  @Column({ nullable: true })
  name: string

  @Column({ nullable: true })
  chainId: string

  @Column({ nullable: true })
  deployer: string

  @Column({ nullable: true })
  bannerUrl: string

  @Column({ nullable: true })
  logoUrl: string

  @Column({ nullable: true })
  description: string

  @Column({ nullable: true, default: false })
  isCurated: boolean

  @Column({ default: false })
  isSpam: boolean

  @Column({ default: false })
  isOfficial: boolean

  @Column({ nullable: true, type: 'numeric' })
  floorPrice: number

  @Column({ nullable: true, type: 'numeric' })
  totalVolume: number

  @Column({ nullable: true, type: 'numeric' })
  averagePrice: number

  @Column({ nullable: true, type: 'integer' })
  totalSales: number

  @Column({ nullable: true, type: 'timestamptz' })
  issuanceDate: Date

  @Column({ nullable: true })
  slug: string
}
