import { cache } from '@nftcom/cache'
import { fetchData } from '@nftcom/nftport-client'
import { entity, repository } from '@nftcom/shared'

const createDefaultStats = (stats: any, totalVolume: number): any => {
  // default values are required so DataFrame has consistent columns
  return {
    one_day_volume: 0.0,
    one_day_change: 0.0,
    one_day_sales: 0,
    one_day_average_price: 0.0,
    seven_day_volume: 0.0,
    seven_day_change: 0.0,
    seven_day_sales: 0,
    seven_day_average_price: 0.0,
    thirty_day_volume: 0.0,
    thirty_day_change: 0.0,
    thirty_day_sales: 0,
    thirty_day_average_price: 0.0,
    total_sales: 0,
    total_supply: 0,
    total_minted: 0,
    num_owners: 0,
    average_price: 0.0,
    market_cap: 0.0,
    floor_price: 0.0,
    floor_price_historic_one_day: 0.0,
    floor_price_historic_seven_day: 0.0,
    floor_price_historic_thirty_day: 0.0,
    updated_date: '',
    ...stats,
    // total_volume should fall back to collection.totalVolume if available
    total_volume: stats?.total_volume || totalVolume || 0.0,
  }
}

const fetchCollections = async (collectionRepo: repository.CollectionRepository):
Promise<(entity.Collection & {stats?: any})[]> => {
  const collections: (entity.Collection & {stats?: any})[] = await collectionRepo.findAllOfficial()
  for (const collection of collections) {
    try {
      const { statistics: stats } = await fetchData('stats', [collection.contract])
      collection.stats = stats
    } catch (_e) {
      collection.stats = createDefaultStats({}, collection.totalVolume)
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
    const score_24h = collection.stats.one_day_volume.toString()
    const score_7d = collection.stats.seven_day_volume.toString()
    const score_30d = collection.stats.thirty_day_volume.toString()
    const score_all = collection.stats.total_volume.toString()
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