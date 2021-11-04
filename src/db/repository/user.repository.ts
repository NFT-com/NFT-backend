import { LessThan } from 'typeorm'

import { User } from '@src/db/entity'

import { BaseRepository } from './base.repository'

export class UserRepository extends BaseRepository<User> {

  constructor() {
    super(User)
  }

  public findByEmail = (email: string): Promise<User | undefined> => {
    return this.findOne({ where: { email } })
  }

  public findByReferralId = (referralId: string): Promise<User | undefined> => {
    return this.findOne({ where: { referralId } })
  }

  public findByEmailConfirmationToken = (confirmEmailToken: string): Promise<User | undefined> => {
    return this.findOne({
      where: {
        confirmEmailToken,
        confirmEmailTokenExpiresAt: LessThan(new Date()),
      },
    })
  }

}
