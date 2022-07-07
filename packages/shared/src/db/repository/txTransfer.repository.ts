import { TxTransfer } from '@nftcom/shared/db/entity'

import { BaseRepository } from './base.repository'

export class TxTransferRepository extends BaseRepository<TxTransfer> {

  constructor() {
    super(TxTransfer)
  }

}
