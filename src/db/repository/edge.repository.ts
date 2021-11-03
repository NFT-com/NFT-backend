import { Edge } from '@src/db/entity'

import { BaseRepository } from './base.repository'

export class EdgeRepository extends BaseRepository<Edge> {

  constructor() {
    super(Edge)
  }

}
