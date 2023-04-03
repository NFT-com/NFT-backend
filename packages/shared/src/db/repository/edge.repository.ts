import { Edge } from '@nftcom/shared/db/entity'

import { BaseRepository } from './base.repository'

export class EdgeRepository extends BaseRepository<Edge> {
  constructor() {
    super(Edge)
  }
}
