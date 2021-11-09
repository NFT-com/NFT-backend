import { Column, Entity, Index } from 'typeorm'

import { BaseEntity } from './base.entity'

@Entity()
@Index(['confirmEmailToken', 'confirmEmailTokenExpiresAt'])
export class User extends BaseEntity {

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
