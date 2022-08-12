import { TxTransaction } from '@nftcom/shared/db/entity'

import { BaseRepository } from './base.repository'

export class TxTransactionRepository extends BaseRepository<TxTransaction> {

  constructor() {
    super(TxTransaction)
  }

}
