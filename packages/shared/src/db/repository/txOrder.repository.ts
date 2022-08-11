import { TxOrder } from '@nftcom/shared/db/entity'

import { BaseRepository } from './base.repository'

export class TxOrderRepository extends BaseRepository<TxOrder> {

  constructor() {
    super(TxOrder)
  }

}
