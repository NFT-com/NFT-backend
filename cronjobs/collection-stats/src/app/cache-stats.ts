import { updateContractStats } from '@nftcom/contract-data'
import { db } from '@nftcom/shared'

import { getConnection } from './data-source'

export const cacheStats = async (): Promise<void> => {
  await getConnection()
  const collections =  await db.newRepositories().collection.findAllOfficial()
  await updateContractStats(collections)
}