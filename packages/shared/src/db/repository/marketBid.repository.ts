import { MarketBid } from '@nftcom/shared/db/entity'

import { BaseRepository } from './base.repository'

export class MarketBidRepository extends BaseRepository<MarketBid> {
  constructor() {
    super(MarketBid)
  }
}
