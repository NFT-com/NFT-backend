import { NFT } from '@nftcom/shared/db/entity'

import { BaseRepository } from './base.repository'

export class NFTRepository extends BaseRepository<NFT> {

  constructor() {
    super(NFT)
  }

}
