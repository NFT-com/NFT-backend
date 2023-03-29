import 'dotenv/config'

import { getContractSales } from '@nftcom/contract-data'
import { _logger, db } from '@nftcom/shared'

import { getConnection } from './data-source'

const logger = _logger.Factory('sales-processor', _logger.Context.MarketplaceSale)

const DATE_RANGE_BUFFER = process.env.DATE_RANGE_BUFFER || '8h'

const repositories = db.newRepositories()

export const updateCollectionSales = async (): Promise<any> => {
  await getConnection()
  const rawAddressResults = await repositories.marketplaceSale.getDistinctContractAddresses()
  for (const raw of rawAddressResults) {
    try {
      await getContractSales(raw.contractAddress, DATE_RANGE_BUFFER)
    } catch (err) {
      logger.error(err)
    }
  }
}
