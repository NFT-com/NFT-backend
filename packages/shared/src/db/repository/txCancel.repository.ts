import { TxCancel } from '@nftcom/shared/db/entity'

import { BaseRepository } from './base.repository'

export class TxCancelRepository extends BaseRepository<TxCancel> {
  constructor() {
    super(TxCancel)
  }
}
