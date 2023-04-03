import { Column, Entity, Index, Unique } from 'typeorm'

import { BaseEntity } from './base.entity'

@Index(['chainId', 'address', 'network'], { unique: true })
@Entity()
@Unique(['address', 'network', 'chainId'])
export class Wallet extends BaseEntity {
  @Index()
  @Column({ nullable: false })
  userId: string

  @Column({ nullable: false })
  chainId: string

  @Column({ nullable: false })
  chainName: string

  @Column({ nullable: false })
  network: string

  @Column({ nullable: false })
  address: string

  @Column({ nullable: true })
  profileId: string
}
