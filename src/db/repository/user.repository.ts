import { isNil } from 'lodash'
import { BaseRepository } from './base.repository'
import { User } from '@src/db/entity'
import { fp } from '@src/helper'

export class UserRepository extends BaseRepository<User> {

  constructor() {
    super(User)
  }

  public findByEmail = (email): Promise<User | null> => {
    return this.findOne({ where: { email } })
      .then(fp.thruIf<User>(isNil)(fp.N))
  }

}
