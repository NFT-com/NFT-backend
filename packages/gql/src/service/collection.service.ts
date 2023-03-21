import { cache } from '@nftcom/cache'
import { hydrateCollectionLeaderboard, updateCollectionLeaderboard } from '@nftcom/leaderboard'
import { _logger, entity, repository } from '@nftcom/shared'

const logger = _logger.Factory('collection.service', _logger.Context.GraphQL)

export type CollectionLeaderboardDateRange = '24h' | '7d' | '30d' | 'all'
export const DEFAULT_COLL_LB_DATE_RANGE = '7d'
export const getSortedLeaderboard =
  async (
    collectionRepo: repository.CollectionRepository,
    opts?: { dateRange?: CollectionLeaderboardDateRange },
  ): Promise<(entity.Collection & { stats?: any })[]> => {
    const { dateRange = DEFAULT_COLL_LB_DATE_RANGE } = opts || {}
    const cacheKey = `COLLECTION_LEADERBOARD_${dateRange}`
    const cachedLeaderboard = await cache.zrange(cacheKey, '+inf', '-inf', 'BYSCORE', 'REV')
    if (!cachedLeaderboard?.length) logger.warn({ dateRange, cacheKey }, 'No cached leaderboard found')
    const leaderboard = cachedLeaderboard && cachedLeaderboard.length ?
      await hydrateCollectionLeaderboard(cachedLeaderboard, { collectionRepo }) :
      // This should never be called in prod, but is here as a fall-back just incase
      await updateCollectionLeaderboard(collectionRepo, cacheKey)

    return leaderboard
  }
