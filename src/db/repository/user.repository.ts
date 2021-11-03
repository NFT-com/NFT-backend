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

  public updateEmailConfirmation = (confirmEmailToken: number): Promise<boolean> => {
    return this.update(
      {
        confirmEmailToken,
        confirmEmailTokenExpiresAt: LessThan(new Date()),
      },
      {
        isEmailConfirmed: true,
        confirmEmailToken: null,
        confirmEmailTokenExpiresAt: null,
      },
    )
      .then((result) => result.affected === 1)
  }

}
