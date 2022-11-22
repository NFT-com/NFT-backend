import { PutMetricDataCommand, PutMetricDataCommandOutput } from '@aws-sdk/client-cloudwatch'
import { _logger, db, defs } from '@nftcom/shared'

import { cwClient } from './cloudwatch-client'
import { getConnection } from './data-source'

const logger = _logger.Factory('query-hidden-nfts', _logger.Context.Misc)

const { NODE_ENV = 'development' } = process.env

export const countHiddenNFTs = async (): Promise<PutMetricDataCommandOutput> => {
  await getConnection()
  const edgeRepo = db.newRepositories().edge
  const hiddenCount = await edgeRepo.count({
    thisEntityType: defs.EntityType.Profile,
    thatEntityType: defs.EntityType.NFT,
    edgeType: defs.EdgeType.Displays,
    hide: true,
  })
  logger.info({ hiddenCount }, 'Got count of hidden edges')
  try {
    return await cwClient.send(new PutMetricDataCommand({
      MetricData: [
        {
          MetricName: 'hidden_nfts',
          Unit: 'Count',
          Value: hiddenCount,
        },
      ],
      Namespace: `NFTCOM/nftcom_edge_${NODE_ENV.toLowerCase()}`,
    }))
  } catch (err) {
    logger.error(err, 'Unable to put metric to cloudwatch')
  }
}