import { TxSale } from '@nftcom/shared/db/entity'

import { BaseRepository } from './base.repository'

export class TxSaleRepository extends BaseRepository<TxSale> {

  constructor() {
    super(TxSale)
  }

}
