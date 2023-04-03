import { Like } from '../entity'
import { BaseRepository } from './base.repository'

export class LikeRepository extends BaseRepository<Like> {
  constructor() {
    super(Like)
  }
}
