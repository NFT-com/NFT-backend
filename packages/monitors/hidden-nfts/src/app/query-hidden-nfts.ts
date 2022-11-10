import { db } from '@nftcom/shared'
import { EdgeType, EntityType } from '@nftcom/shared/defs'

import { getConnection } from './data-source'

export const cacheStats = async (): Promise<void> => {
  await getConnection()
  const edgeRepo = db.newRepositories().edge
  const hiddenCount = await edgeRepo.count({
    thisEntityType: EntityType.Profile,
    thatEntityType: EntityType.NFT,
    edgeType: EdgeType.Displays,
    hide: true,
  })
  console.log(hiddenCount)
}