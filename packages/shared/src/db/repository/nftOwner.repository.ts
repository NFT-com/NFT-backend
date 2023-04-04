import { NFTOwner } from '../entity'
import { BaseRepository } from './base.repository'

export class NFTOwnerRepository extends BaseRepository<NFTOwner> {
  constructor() {
    super(NFTOwner)
  }
}
