import { Collection } from '@nftcom/shared/db/entity'

import { BaseRepository } from './base.repository'

export class CollectionRepository extends BaseRepository<Collection> {

  constructor() {
    super(Collection)
  }

}
