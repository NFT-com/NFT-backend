import { Comment } from '../entity'
import { BaseRepository } from './base.repository'

export class CommentRepository extends BaseRepository<Comment> {

  constructor() {
    super(Comment)
  }

}
