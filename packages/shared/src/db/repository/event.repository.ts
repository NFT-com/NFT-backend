import { Event } from '../entity'
import { BaseRepository } from './base.repository'

export class EventRepository extends BaseRepository<Event> {
  constructor() {
    super(Event)
  }
}
