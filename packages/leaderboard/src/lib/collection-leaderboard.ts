import { cache } from '@nftcom/cache'
import { fetchData } from '@nftcom/nftport-client'
import { entity, repository } from '@nftcom/shared'

const fetchCollections = async (collectionRepo: repository.CollectionRepository):
Promise<(entity.Collection & {stats?: any})[]> => {
  const collections: (entity.Collection & {stats?: any})[] = await collectionRepo.findAllOfficial()
  for (const collection of collections) {
    try {
      const { statistics: stats } = await fetchData('stats', [collection.contract])
      collection.stats = stats || {}
    } catch (_e) {
      collection.stats = { total_volume: collection.totalVolume || 0 }
    }
  }
  return collections
}

const FILTERED_ART_BLOCKS_CONTRACT = '0xa7d8d9ef8D8Ce8992Df33D8b8CF4Aebabd5bD270'
export const hydrateCollectionLeaderboard = async (
  leaderboardContracts: string[],
  opts?: {
    existingCollections?: (entity.Collection & {stats?: any})[]
    collectionRepo?: repository.CollectionRepository
  },
): Promise<(entity.Collection & {stats?: any})[]>  => {
  if (!leaderboardContracts.length) return []
  const collections = opts?.existingCollections ?
    opts?.existingCollections :
    await fetchCollections(opts?.collectionRepo)
  return leaderboardContracts.map((contract) => {
    return collections.find((c) => c.contract === contract)
  }).filter((collection) => collection && collection.contract !== FILTERED_ART_BLOCKS_CONTRACT) // filter to remove any nulls from previously official collections
}

export const updateCollectionLeaderboard = async (collectionRepo: repository.CollectionRepository, cacheKey?: string):
Promise<(entity.Collection & {stats?: any})[]> => {
  // Get official collections and add NFTPort stats
  const collections: (entity.Collection & {stats?: any})[] = await fetchCollections(collectionRepo)
  // Save score to cache
  for (const collection of collections) {
    const score_24h = collection.stats.one_day_volume?.toString() || '0'
    const score_7d = collection.stats.seven_day_volume?.toString() || '0'
    const score_30d = collection.stats.thirty_day_volume?.toString() || '0'
    const score_all = collection.stats.total_volume?.toString() || '0'
    await Promise.all([
      cache.zadd('COLLECTION_LEADERBOARD_24h', score_24h, collection.contract),
      cache.zadd('COLLECTION_LEADERBOARD_7d', score_7d, collection.contract),
      cache.zadd('COLLECTION_LEADERBOARD_30d', score_30d, collection.contract),
      cache.zadd('COLLECTION_LEADERBOARD_all', score_all, collection.contract),
    ])
  }
  // Get requested leaderboard back from cache
  const leaderboardContracts = cacheKey ?
    await cache.zrange(cacheKey, '+inf', '-inf', 'BYSCORE', 'REV') :
    []
  return hydrateCollectionLeaderboard(leaderboardContracts, { existingCollections: collections })
}
