import { Column, Entity, Index } from 'typeorm'

import { gql } from '@src/defs'

import { Base } from './base.entity'

@Entity()
export class Profile extends Base {

  @Index()
  @Column({ nullable: false, unique: true })
  url: string

  @Index()
  @Column({ nullable: true })
  ownerUserId: string

  @Column({ nullable: true })
  ownerWalletId: string

  @Column({
    type: 'enum',
    enum: gql.ProfileStatus,
    nullable: false,
    default: gql.ProfileStatus.Available,
  })
  status: gql.ProfileStatus

  @Column({ nullable: true })
  bannerURL: string

}
