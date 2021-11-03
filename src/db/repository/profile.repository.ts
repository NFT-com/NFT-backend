import { Profile } from '@src/db/entity'

import { BaseRepository } from './base.repository'

export class ProfileRepository extends BaseRepository<Profile> {

  constructor() {
    super(Profile)
  }

  public findByOwner = (userId: string): Promise<Profile[] | undefined> => {
    return this.find({ where: { ownerUserId: userId } })
  }

  public findByURL = (url: string): Promise<Profile | undefined> => {
    return this.findOne({ where: { url } })
  }

}
