import { updateContractStats } from '@nftcom/contract-data'
import { updateCollectionLeaderboard } from '@nftcom/leaderboard'
import { db } from '@nftcom/shared'

import { getConnection } from './data-source'

export const cacheStats = async (): Promise<void> => {
  await getConnection()
  const collectionRepo = db.newRepositories().collection
  const collections =  await collectionRepo.findAllOfficial()
  await updateContractStats(collections)
  await updateCollectionLeaderboard(collectionRepo)
}