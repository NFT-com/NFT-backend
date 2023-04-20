import { MarketAsk } from '../entity'
import { BaseRepository } from './base.repository'

export class MarketAskRepository extends BaseRepository<MarketAsk> {
  constructor() {
    super(MarketAsk)
  }
}
