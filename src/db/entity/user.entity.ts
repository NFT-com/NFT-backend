import { Column, Entity, Index } from 'typeorm'

import { Base } from './base.entity'

@Entity()
@Index(['confirmEmailToken', 'confirmEmailTokenExpiresAt'])
export class User extends Base {

  @Index()
  @Column({ unique: true })
  email: string

  @Column('boolean', { default: false })
  isEmailConfirmed: boolean

  @Column({ select: false, nullable: true, unique: true })
  confirmEmailToken: string

  @Column({ select: false, nullable: true })
  confirmEmailTokenExpiresAt: Date

  @Column({ nullable: true })
  avatarURL: string

  @Index()
  @Column({ nullable: false })
  referralId: string

  @Column({ nullable: true })
  referredBy: string

}
