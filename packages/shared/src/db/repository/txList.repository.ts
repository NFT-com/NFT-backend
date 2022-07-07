import { TxList } from '@nftcom/shared/db/entity'

import { BaseRepository } from './base.repository'

export class TxListRepository extends BaseRepository<TxList> {

  constructor() {
    super(TxList)
  }

}
