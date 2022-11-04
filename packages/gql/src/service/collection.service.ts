import { cache } from '@nftcom/cache'
import { fetchData } from '@nftcom/nftport-client'
import { entity, repository } from '@nftcom/shared'

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