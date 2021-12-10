import { NFTRaw } from '@nftcom/shared/db/entity'

import { BaseRepository } from './base.repository'

export class NFTRawRepository extends BaseRepository<NFTRaw> {
  
  constructor() {
    super(NFTRaw)
  }

}
