import { fetchData } from '@nftcom/nftport-client'
import { db, entity } from '@nftcom/shared'

const SECONDS_PER_HOUR = 60 * 60
const DB_CHUNK_SIZE = 500

export const updateContractStats = async (collections: entity.Collection[]): Promise<entity.Collection[]> => {
  const updatedCollections = await Promise.all(
    collections.map(async collection => {
      try {
        const { statistics: stats } = await fetchData('stats', [collection.contract], {
          cacheSeconds: SECONDS_PER_HOUR,
        })
        collection.floorPrice = stats.floor_price
        collection.totalVolume = stats.total_volume
        collection.averagePrice = stats.average_price
        collection.totalSales = stats.total_sales
      } catch (_e) {
        // NFTPort doesn't have this collection, so leave as-is
      }
      return collection
    }),
  )
  return db.getDataSource().getRepository(entity.Collection).save(updatedCollections, { chunk: DB_CHUNK_SIZE })
}
