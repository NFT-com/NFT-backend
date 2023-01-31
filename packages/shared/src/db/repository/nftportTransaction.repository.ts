import { NFTPortTransactionEntity } from '@nftcom/shared/db/entity'

import { BaseRepository } from './base.repository'

export class NFTPortTransactionRepository extends BaseRepository<NFTPortTransactionEntity> {

  constructor() {
    super(NFTPortTransactionEntity)
  }

}
