import { Column, Entity, Index } from 'typeorm'

import { Base } from './base.entity'

@Entity()
export class Profile extends Base {

  @Index({ unique: true })
  @Column({ nullable: false })
  url: string

  @Column({ nullable: false })
  creatorUserId: string

  @Index()
  @Column({ nullable: false })
  ownerUserId: string

  @Column({ nullable: false })
  creatorWalletId: string

  @Column({ nullable: false })
  ownerWalletId: string

}
