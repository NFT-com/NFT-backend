import { IncentiveAction } from '@nftcom/shared/db/entity'

import { BaseRepository } from './base.repository'

export class IncentiveActionRepository extends BaseRepository<IncentiveAction> {
  constructor() {
    super(IncentiveAction)
  }
}
