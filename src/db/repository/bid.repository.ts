import { Bid } from '@src/db/entity'

import { BaseRepository } from './base.repository'

export class BidRepository extends BaseRepository<Bid> {

  constructor() {
    super(Bid)
  }

}
