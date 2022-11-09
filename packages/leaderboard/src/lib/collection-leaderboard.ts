import { DataFrame, MinMaxScaler, Series } from 'danfojs-node'

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

/**
 * Calculates a score for three columns of a DataFrame
 * 
 * The goal is to give the highest weight to the first column,
 * the second highest weight to the second column,
 * and the lowest weight to the third column.
 * 
 * For example, calculateScore(df_enc, ['seven_day_sales', 'seven_day_volume', 'total_volume'])
 * will score 'seven_day_sales' as the most important factor,
 * 'seven_day_volume' as the second most important, and 'total_volume' as the least important.
 * 
 * @param df The DataFrame containing the data
 * @param columns Three DataFrame columns to use
 * @returns {Series} danfo.js Series containing scores indexed by collection contract
 */
const calculateScore = (df: DataFrame, columns: string[]): Series => {
  return df.loc({ columns }).apply((data: number[]) => {
    // Get coefficients so score ranges do not overlap
    const c0 = data[0] ? 9 : 0
    const c1 = data[1] ? 2 : 0
    return (c0 * Math.pow(1 + data[0], 3)) + (c1 * Math.pow(1 + data[1], 2)) + data[2]
  }) as Series
}

const fetchCollections = async (collectionRepo: repository.CollectionRepository):
Promise<(entity.Collection & {stats?: any})[]> => {
  const collections: (entity.Collection & {stats?: any})[] = await collectionRepo.findAllOfficial()
  for (const collection of collections) {
    try {
      const { statistics: stats } = await fetchData('stats', [collection.contract])
      collection.stats = stats
    } catch (_e) {
      // noop
    }
  }
  return collections
}

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
  })
}

export const updateCollectionLeaderboard = async (collectionRepo: repository.CollectionRepository, cacheKey?: string):
Promise<(entity.Collection & {stats?: any})[]> => {
  // Get official collections and add NFTPort stats
  const collections: (entity.Collection & {stats?: any})[] = await fetchCollections(collectionRepo)
  // Create a dataframe with just the stats and contract address
  const data = collections.map((c) => {
    const { updated_date, ...stats } = createDefaultStats(c.stats, c.totalVolume)
    return { ...stats, contract: c.contract }
  })
  const df = new DataFrame(data)
  df.setIndex({ column: 'contract', drop: true, inplace: true })
  // Normalize stats for scoring
  const df_enc = new MinMaxScaler().fit(df).transform(df).fillNa(0)
  // Get scores for each timeframe
  const scores_24h = calculateScore(df_enc, ['one_day_sales', 'one_day_volume', 'total_volume'])
  const scores_7d = calculateScore(df_enc, ['seven_day_sales', 'seven_day_volume', 'total_volume'])
  const scores_30d = calculateScore(df_enc, ['thirty_day_sales', 'thirty_day_volume', 'total_volume'])
  const scores_all = calculateScore(df_enc, ['total_sales', 'total_volume', 'floor_price'])
  // Save score to cache
  for (const [index, contract] of df_enc.index.entries()) {
    const score_24h = scores_24h.values[index].toString()
    const score_7d = scores_7d.values[index].toString()
    const score_30d = scores_30d.values[index].toString()
    const score_all = scores_all.values[index].toString()
    await Promise.all([
      cache.zadd('COLLECTION_LEADERBOARD_24h', score_24h, contract),
      cache.zadd('COLLECTION_LEADERBOARD_7d', score_7d, contract),
      cache.zadd('COLLECTION_LEADERBOARD_30d', score_30d, contract),
      cache.zadd('COLLECTION_LEADERBOARD_all', score_all, contract),
    ])
  }
  // Get requested leaderboard back from cache
  const leaderboardContracts = cacheKey ?
    await cache.zrange(cacheKey, '-inf', '+inf', 'BYSCORE') :
    []
  return hydrateCollectionLeaderboard(leaderboardContracts, { existingCollections: collections })
}