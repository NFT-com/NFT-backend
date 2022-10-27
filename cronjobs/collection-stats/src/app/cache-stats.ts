import { updateContractStats } from '@nftcom/contract-data'
import { db, entity } from '@nftcom/shared'

import { getConnection } from './data-source'

export const cacheStats = async (): Promise<void> => {
  await getConnection()
  const collections =  await db.getDataSource().getRepository(entity.Collection).find({
    where: {
      isOfficial: true,
    },
  })
  console.log('COLLECTIONS', collections)
  await updateContractStats(collections)
}