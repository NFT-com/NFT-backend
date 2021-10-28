import { Entity, Index, Column } from 'typeorm'

import { Base } from './base.entity'

@Entity()
export class User extends Base {

  @Index({ unique: true })
  @Column({ nullable: true, unique: true })
  email: string

  @Column('boolean', { default: false })
  isEmailConfirmed: boolean

  @Column({ select: false, nullable: true })
  confirmEmailToken: string

  @Column({ nullable: true })
  profileURI: string

  // TODO Blockchain address?
  @Column({ nullable: true })
  referredBy: string

}
