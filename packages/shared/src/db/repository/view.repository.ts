import { View } from '../entity'
import { BaseRepository } from './base.repository'

export class ViewRepository extends BaseRepository<View> {

  constructor() {
    super(View)
  }

}
