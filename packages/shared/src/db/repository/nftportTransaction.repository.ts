import { NFTPortTransaction } from '@nftcom/shared/db/entity'

import { BaseRepository } from './base.repository'

export class NFTPortTransactionRepository extends BaseRepository<NFTPortTransaction> {

  constructor() {
    super(NFTPortTransaction)
  }

}
