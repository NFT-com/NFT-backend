import { TxBid } from '@nftcom/shared/db/entity'

import { BaseRepository } from './base.repository'

export class TxBidRepository extends BaseRepository<TxBid> {

  constructor() {
    super(TxBid)
  }

}
