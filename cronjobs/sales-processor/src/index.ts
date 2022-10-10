import 'dotenv/config'

import { contractData } from '@nftcom/gql/service'
import { _logger, db } from '@nftcom/shared'

import { getConnection } from './data-source'

const logger = _logger.Factory('sales-processor', _logger.Context.MarketplaceSale)

const DATE_RANGE_BUFFER = process.env.DATE_RANGE_BUFFER || '3d'

const repositories = db.newRepositories()

const updateCollectionSales = async (): Promise<any> => {
  await getConnection()
  const rawAddressResults = await repositories.marketplaceSale.getDistinctContractAddresses()
  for (const raw of rawAddressResults) {
    try {
      await contractData.getSalesData(raw.contractAddress, DATE_RANGE_BUFFER)
    } catch (err) {
      logger.error(err)
    }
  }
}

if (require.main === module) {
  updateCollectionSales().then(() => {
    process.exit()
  })
}