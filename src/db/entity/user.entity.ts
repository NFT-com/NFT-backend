import { Column, Entity, Index } from 'typeorm'

import { Base } from './base.entity'

@Entity()
export class User extends Base {

  @Index()
  @Column({ unique: true })
  email: string

  @Column('boolean', { default: false })
  isEmailConfirmed: boolean

  @Column({ select: false, nullable: true, unique: true })
  confirmEmailToken: number

  @Column({ select: false, nullable: true })
  confirmEmailTokenExpiresAt: Date

  @Column({ nullable: true })
  avatarURL: string

  // TODO email address or userId?
  @Column({ nullable: true })
  referredBy: string

}
