import { Profile, Wallet } from '@nftcom/shared/db/entity'

import { BaseRepository } from './base.repository'

export class ProfileRepository extends BaseRepository<Profile> {

  constructor() {
    super(Profile)
  }

  public findByOwner = (userId: string): Promise<Profile[] | undefined> => {
    return this.find({ where: { ownerUserId: userId } })
  }

  public findByURL = (url: string, chainId: string): Promise<Profile | undefined> => {
    return this.findOne({ where: { url, chainId } })
  }

  findAllWithRelations(): Promise<Profile[]> {
    return this.getRepository(true)
      .createQueryBuilder('profile')
      .leftJoinAndMapOne('profile.wallet', Wallet, 'wallet', 'profile.ownerWalletId = wallet.id')
      .getMany()
  }

}
