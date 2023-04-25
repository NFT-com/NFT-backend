import { Curation } from '../entity'
import { BaseRepository } from './base.repository'

export class CurationRepository extends BaseRepository<Curation> {
  constructor() {
    super(Curation)
  }
}
