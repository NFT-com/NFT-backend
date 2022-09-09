import { MarketplaceSale } from '@nftcom/shared/db/entity/marketplaceSale.entity'

import { BaseRepository } from './base.repository'

export class MarketplaceSaleRepository extends BaseRepository<MarketplaceSale> {

  constructor() {
    super(MarketplaceSale)
  }

}
