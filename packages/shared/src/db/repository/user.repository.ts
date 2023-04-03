import { MoreThan } from 'typeorm'

import { User } from '@nftcom/shared/db/entity'

import { BaseRepository } from './base.repository'

export class UserRepository extends BaseRepository<User> {
  constructor() {
    super(User)
  }

  public findByEmail = (email: string): Promise<User | undefined> => {
    return this.findOne({ where: { email } })
  }

  public findByUsername = (username: string): Promise<User | undefined> => {
    return this.findOne({ where: { username } })
  }

  public findByReferralId = (referralId: string): Promise<User | undefined> => {
    return this.findOne({ where: { referralId } })
  }

  public findByEmailConfirmationToken = (confirmEmailToken: string): Promise<User | undefined> => {
    return this.findOne({
      where: {
        confirmEmailToken,
        confirmEmailTokenExpiresAt: MoreThan(new Date()),
      },
    })
  }
}
