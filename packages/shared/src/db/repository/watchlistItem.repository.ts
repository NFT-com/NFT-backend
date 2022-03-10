import { WatchlistItem } from '@nftcom/shared/db/entity'

import { BaseRepository } from './base.repository'

export class WatchlistItemRepository extends BaseRepository<WatchlistItem> {

  constructor() {
    super(WatchlistItem)
  }

  findByWatchlistId(watchlistId: string): Promise<WatchlistItem[]> {
    return this.find({ where: { inWatchlist: watchlistId } })
  }

}
