import { Bid } from '@src/db/entity'

import { BaseRepository } from './base.repository'

export class BidRepository extends BaseRepository<Bid> {

  constructor() {
    super(Bid)
  }

  public findTopBidsBy = (filter: Partial<Bid>): Promise<Bid[]> => {
    return this.getRepository()
      .createQueryBuilder('bid')
      .where({ ...filter, deletedAt: null })
      .distinctOn(['bid.profileId'])
      .orderBy({ 'bid.price': 'DESC' })
      .cache(true)
      .getMany()
  }

  public findTopBidByProfile = (profileId: string): Promise<Bid> => {
    return this.findOne({
      where: { profileId, deletedAt: null },
      order: { price: 'DESC' },
    })
  }

  public findRecentBidByProfileUser = (profileId: string, userId: string): Promise<Bid> => {
    return this.findOne({
      where: { profileId, userId, deletedAt: null },
      order: { updatedAt: 'DESC' },
    })
  }

}
