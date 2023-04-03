import { Event } from '@nftcom/shared/db/entity'

import { BaseRepository } from './base.repository'

export class EventRepository extends BaseRepository<Event> {
  constructor() {
    super(Event)
  }
}
