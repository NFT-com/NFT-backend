import { PutMetricDataCommand, PutMetricDataCommandOutput } from '@aws-sdk/client-cloudwatch'
import { _logger, db } from '@nftcom/shared'
import { EdgeType, EntityType } from '@nftcom/shared/defs'

import { cwClient } from './cloudwatch-client'
import { getConnection } from './data-source'

const logger = _logger.Factory('query-hidden-nfts', _logger.Context.Misc)

export const countHiddenNFTs = async (): Promise<PutMetricDataCommandOutput> => {
  await getConnection()
  const edgeRepo = db.newRepositories().edge
  const hiddenCount = await edgeRepo.count({
    thisEntityType: EntityType.Profile,
    thatEntityType: EntityType.NFT,
    edgeType: EdgeType.Displays,
    hide: true,
  })
  try {
    return await cwClient.send(new PutMetricDataCommand({
      MetricData: [
        {
          MetricName: 'HIDDEN_NFTS',
          Unit: 'Count',
          Value: hiddenCount,
        },
      ],
      Namespace: 'NFTCOM/EDGE',
    }))
  } catch (err) {
    logger.error(err, 'Unable to put metric to cloudwatch')
  }
}