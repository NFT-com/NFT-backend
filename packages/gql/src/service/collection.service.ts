import { cache } from '@nftcom/cache'
import { appError } from '@nftcom/error-types'
import { gql } from '@nftcom/gql/defs'
import { pagination } from '@nftcom/gql/helper'
import { hydrateCollectionLeaderboard, updateCollectionLeaderboard } from '@nftcom/leaderboard'
import { _logger, entity, fp, repository } from '@nftcom/shared'

import { core } from '../service'

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

interface GetOfficialCollectionArgs {
  collectionRepo: repository.CollectionRepository
  defaultNumItems?: number
  pageInput: gql.PageInput
}

/**
 * Get the official collections from the database.
 * @param {GetOfficialCollectionArgs} args - The arguments to pass to the function.
 * @returns {Promise<any>} A promise that resolves to the official collections.
 */
export const getOfficialCollections = async ({
  collectionRepo,
  defaultNumItems = 100,
  pageInput,
}: GetOfficialCollectionArgs): Promise<any> => {
  const safePageInput = pagination.safeInput(pageInput, undefined, defaultNumItems)
  logger.warn(safePageInput)
  const [officialCollectionsErr, officialCollections] =
    await fp.promiseTo(collectionRepo.findOfficialCollections())
  if (officialCollectionsErr) {
    appError.buildCustom(`getOfficialCollections Error: ${JSON.stringify(officialCollectionsErr, null, 2)}`)
  }

  const paginatedResults =
    await core.paginateEntityArray(officialCollections, safePageInput)
  logger.warn({ safePageInput, paginatedResults })

  return pagination.toPageable(safePageInput, paginatedResults[0][0], paginatedResults[0][paginatedResults.length - 1], 'id')(paginatedResults)
}
