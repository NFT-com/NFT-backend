import { DataFrame, MinMaxScaler, toJSON } from 'danfojs-node'

import { cache } from '@nftcom/cache'
import { fetchData } from '@nftcom/nftport-client'
import { entity, repository } from '@nftcom/shared'

const createDefaultStats = (stats: any, totalVolume: number): any => {
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
    total_volume: totalVolume || 0.0,
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
  }
}

export const getSortedLeaderboard =
async (collectionRepo: repository.CollectionRepository): Promise<entity.Collection[]> => {
  const cacheKey = 'COLLECTION_LEADERBOARD'
  const cachedResult = await cache.get(cacheKey)
  if (cachedResult) {
    return JSON.parse(cachedResult)
  }
  const collections: (entity.Collection & {stats?: any})[] = await collectionRepo.findAllOfficial()
  for (const collection of collections) {
    try {
      const { statistics: stats } = await fetchData('stats', [collection.contract])
      collection.stats = stats
    } catch (_e) {
      // noop
    }
  }
  const data = collections.map((c) => {
    const { updated_date, ...stats } = createDefaultStats(c.stats, c.totalVolume)
    return { ...stats, contract: c.contract }
  })
  const df = new DataFrame(data)
  df.setIndex({ column: 'contract', drop: true, inplace: true })
  df.loc({ columns: ['seven_day_sales', 'seven_day_volume', 'total_volume'] }).print()
  const scaler = new MinMaxScaler()
  scaler.fit(df.loc({ columns: ['seven_day_sales', 'seven_day_volume', 'total_volume'] }))
  const df_enc = scaler.transform(df.loc({ columns: ['seven_day_sales', 'seven_day_volume', 'total_volume'] }))
  df_enc.fillNa(0, { inplace: true })
  df_enc.print()
  const scores = df_enc.loc({ columns: ['seven_day_sales', 'seven_day_volume', 'total_volume'] }).apply((data) => {
    console.log(data)
    const c0 = data[0] ? 3 : 0
    const c1 = data[1] ? 2 : 0
    return (c0 * Math.pow(1 + data[0], 3)) + (c1 * Math.pow(1 + data[1], 2)) + data[2]
  })
  console.log(toJSON(scores))
  
  collections.sort((a, b) => {
    if (a.stats && !b.stats) {
      return -1
    } else if (b.stats && !a.stats) {
      return 1
    } else if (!a.stats && !b.stats) {
      return b.totalVolume - a.totalVolume
    }
    return b.stats.seven_day_sales - a.stats.seven_day_sales
      || b.stats.seven_day_volume - a.stats.seven_day_volume
  })
  const leaderboard = collections.map(({ stats, ...props }) => props) as entity.Collection[]

  cache.set(
    cacheKey,
    JSON.stringify(leaderboard),
    'EX',
    60 * 60 * 24, // 24 hours
  )
  return leaderboard
}