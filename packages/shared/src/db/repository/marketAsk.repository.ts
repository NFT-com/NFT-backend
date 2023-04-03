import { MarketAsk } from '@nftcom/shared/db/entity'

import { BaseRepository } from './base.repository'

export class MarketAskRepository extends BaseRepository<MarketAsk> {
  constructor() {
    super(MarketAsk)
  }
}
