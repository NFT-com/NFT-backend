import { Bid } from '@src/db/entity'
import { PageInput } from '@src/defs/gql'
import { getSkip, getTake } from '@src/helper/pagination'

import { BaseRepository } from './base.repository'

export class BidRepository extends BaseRepository<Bid> {

  constructor() {
    super(Bid)
  }

  public findTopBidsBy = (filter: Partial<Bid>, pageInput: PageInput): Promise<[Bid[], number]> => {
    return this.getRepository()
      .createQueryBuilder('bid')
      .where({ ...filter, deletedAt: null })
      .skip(getSkip(pageInput))
      .take(getTake(pageInput))
      .distinctOn(['bid.profileId'])
      .orderBy({ 'bid.price': 'DESC' })
      .cache(true)
      .getManyAndCount()
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
