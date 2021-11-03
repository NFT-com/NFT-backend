import { Approval } from '@src/db/entity'

import { BaseRepository } from './base.repository'

export class ApprovalRepository extends BaseRepository<Approval> {

  constructor() {
    super(Approval)
  }

}
