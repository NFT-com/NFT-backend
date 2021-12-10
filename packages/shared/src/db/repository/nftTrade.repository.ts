import { NFTTrade } from '@nftcom/shared/db/entity'

import { BaseRepository } from './base.repository'

export class NFTTradeRepository extends BaseRepository<NFTTrade> {
  
  constructor() {
    super(NFTTrade)
  }

}
