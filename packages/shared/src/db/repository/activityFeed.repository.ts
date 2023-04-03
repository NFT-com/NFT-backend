import { ActivityFeed } from '../entity'
import { BaseRepository } from './base.repository'

export class ActivityFeedRepository extends BaseRepository<ActivityFeed> {
  constructor() {
    super(ActivityFeed)
  }
}
