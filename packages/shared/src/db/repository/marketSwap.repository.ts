import { MarketSwap } from '@nftcom/shared/db/entity'

import { BaseRepository } from './base.repository'

export class MarketSwapRepository extends BaseRepository<MarketSwap> {
  constructor() {
    super(MarketSwap)
  }
}
