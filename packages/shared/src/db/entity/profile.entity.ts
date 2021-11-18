import { Column, Entity, Index } from 'typeorm'

import { ProfileStatus } from '@nftcom/shared/defs'

import { BaseEntity } from './base.entity'

// TODO recheck indexes after some data is available
@Entity()
@Index(['ownerUserId', 'deletedAt', 'createdAt', 'status'])
export class Profile extends BaseEntity {

  @Index()
  @Column({ nullable: false, unique: true })
  url: string

  @Column({ nullable: true })
  ownerUserId: string

  @Column({ nullable: true })
  ownerWalletId: string

  @Column({
    type: 'enum',
    enum: ProfileStatus,
    nullable: false,
    default: ProfileStatus.Available,
  })
  status: ProfileStatus

  @Column({ nullable: true })
  bannerURL: string

  @Column({ nullable: true })
  photoURL: string

  @Column({ nullable: true })
  description: string

}
