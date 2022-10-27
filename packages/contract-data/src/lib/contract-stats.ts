import { fetchData } from '@nftcom/nftport-client'
import { db } from '@nftcom/shared'
import { Collection } from '@nftcom/shared/db/entity'

const SECONDS_PER_DAY = 60 * 60 * 24
const DB_CHUNK_SIZE = 500

export const updateContractStats = async (collections: Collection[]): Promise<Collection[]> => {
  const updatedCollections = await Promise.all(collections.map(async (collection) => {
    const { statistics: stats } = await fetchData('stats', [collection.contract], { cacheSeconds: SECONDS_PER_DAY })
    collection.floorPrice = stats.floor_price
    collection.totalVolume = stats.total_volume
    collection.averagePrice = stats.average_price
    return collection
  }))
  return db.getDataSource().getRepository(Collection).save(updatedCollections, { chunk: DB_CHUNK_SIZE })
}