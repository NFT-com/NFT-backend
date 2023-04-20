import { IncentiveAction } from '../entity'
import { BaseRepository } from './base.repository'

export class IncentiveActionRepository extends BaseRepository<IncentiveAction> {
  constructor() {
    super(IncentiveAction)
  }
}
