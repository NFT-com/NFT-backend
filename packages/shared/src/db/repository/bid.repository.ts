import { Bid } from '../entity'
import { BaseRepository } from './base.repository'

export class BidRepository extends BaseRepository<Bid> {
  constructor() {
    super(Bid)
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
