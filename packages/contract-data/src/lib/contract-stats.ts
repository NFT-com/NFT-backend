import { fetchData } from '@nftcom/nftport-client'
import { Collection } from '@nftcom/shared/db/entity'

const SECONDS_PER_DAY = 60 * 60 * 24
const saveContractStats = (collections: Collection[]): void => {
  const _updatedCollections = collections.map(async (collection) => {
    const stats = await fetchData('stats', [collection.contract], { cacheSeconds: SECONDS_PER_DAY })
    collection.floorPrice = stats.floor_price
    collection.totalVolume = stats.total_volume
    collection.averagePrice = stats.average_price
  })
  // Save updatedCollections
}

export const createContractStats = (): any => {
  return {
    saveContractStats,
  }
}