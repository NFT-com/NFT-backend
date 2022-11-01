import crypto from 'crypto'
import { parseISO } from 'date-fns'
import isBefore from 'date-fns/isBefore'
import sub from 'date-fns/sub'
import { Contract, utils } from 'ethers'
import { differenceBy } from 'lodash'
import { MoreThanOrEqual } from 'typeorm'

import { cache } from '@nftcom/cache'
import { fetchData } from '@nftcom/nftport-client'
import { db, provider, typechain } from '@nftcom/shared'
import { _logger } from '@nftcom/shared'
import { MarketplaceSale } from '@nftcom/shared/db/entity'

const logger = _logger.Factory('ContractDataService', _logger.Context.GraphQL)

const repositories = db.newRepositories()

const durationMap = {
  y: 'years',
  m: 'months',
  d: 'days',
  h: 'hours',
}

const parseDateRangeForDateFns = (dateRange: string): { [duration: string]: number } => {
  return {
    [durationMap[dateRange.slice(-1)]]: parseInt(dateRange.slice(0, -1)),
  }
}

const createTxIdFromNFTPortData = (tx): string => {
  const hmac = crypto.createHmac('sha256', 'contractData')
  return hmac
    .update(`${tx.transaction_hash}-${tx.buyer_address}-${tx.seller_address}-${tx.nft.token_id}`)
    .digest('hex')
}

const getSymbolForContract = async (contractAddress: string): Promise<string> => {
  const key = `ERC20_SYMBOL_${contractAddress}`
  let symbol = await cache.get(key)
  if (!symbol) {
    const contract = new Contract(
      contractAddress,
      typechain.ERC20Metadata__factory.abi,
      provider.provider(),
    ) as unknown as typechain.ERC20Metadata
    try {
      symbol = await contract.symbol()
    } catch (e) {
      symbol = 'UNKNOWN'
      logger.error(e, `Symbol not found for ${contractAddress}`)
    }
    cache.set(key, symbol)
  }
  return symbol
}

const getSymbolFromNFTPortData = async (tx): Promise<string> => {
  const assetType = tx.price_details.asset_type
  return assetType === 'ETH' ? assetType : await getSymbolForContract(tx.price_details.contract_address)
}

const marketplaceSalesFromNFTPortTransactions = async (txns: any[]): Promise<any> => {
  const transformed = []
  for (const tx of txns) {
    transformed.push({
      id: createTxIdFromNFTPortData(tx),
      priceUSD: tx.price_details.price_usd,
      price: tx.price_details.price,
      symbol: await getSymbolFromNFTPortData(tx),
      date: parseISO(tx.transaction_date),
      contractAddress: utils.getAddress(tx.nft.contract_address),
      tokenId: tx.nft.token_id,
      transaction: tx,
    } as MarketplaceSale)
  }
  return transformed
}

const retrievePersistedSales =
async (contractAddress: string, oldestTransactionDate: Date, tokenId: string): Promise<MarketplaceSale[]> => {
  let whereOptions: any = {
    contractAddress: utils.getAddress(contractAddress),
    date: MoreThanOrEqual(oldestTransactionDate),
  }
  if (tokenId) {
    whereOptions = {
      ...whereOptions,
      tokenId,
    }
  }
  return repositories.marketplaceSale.find({
    where: {
      ...whereOptions,
    },
    order: {
      date: 'DESC',
    },
  })
}

const determineOldestTransactionDateForCollectionUpdate =
(now: Date, tokenId: string, savedSales: MarketplaceSale[]): Date => {
  const yesterday = sub(now, parseDateRangeForDateFns('1d'))
  if (!tokenId && isBefore(savedSales[0].date, yesterday)) {
    return savedSales[0].date
  }
  return yesterday
}

export const getContractSales = async (
  contractAddress: string,
  dateRange = 'all',
  tokenId: string = undefined,
): Promise<MarketplaceSale[]> => {
  const endpoint = tokenId ? 'txByNFT' : 'txByContract'
  const args = [contractAddress, tokenId].filter((x) => !!x) // not falsey
  const now = new Date()

  let oldestTransactionDate =
    dateRange === 'all'
      ? new Date('2015-07-30T00:00:00') // ETH release date
      : sub(now, parseDateRangeForDateFns(dateRange))

  let salesData = { transactions: [] } as any,
    filteredTxns = [],
    result: MarketplaceSale[] = [],
    continuation: string

  const savedSales = await retrievePersistedSales(contractAddress, oldestTransactionDate, tokenId)
  if (savedSales.length) {
    oldestTransactionDate = determineOldestTransactionDateForCollectionUpdate(now, tokenId, savedSales)
  }

  let getMoreSalesData = true
  const saleFilterCount = new Map() // count sale IDs because NFTPort data can be bad
  while (getMoreSalesData) {
    salesData = await fetchData(endpoint, args, { queryParams: { chain: 'ethereum', type: 'sale', continuation } })
    if (salesData.transactions && salesData.transactions.length) {
      if (
        !isBefore(
          parseISO(salesData.transactions[salesData.transactions.length - 1].transaction_date),
          oldestTransactionDate,
        )
      ) {
        filteredTxns = salesData.transactions.filter((tx) => tx.type === 'sale')
      } else {
        filteredTxns = salesData.transactions.filter((tx) => {
          return tx.type === 'sale' && !isBefore(parseISO(tx.transaction_date), oldestTransactionDate)
        })
        getMoreSalesData = false
      }
      const marketplaceSales = await marketplaceSalesFromNFTPortTransactions(filteredTxns)
      for (const sale of marketplaceSales) {
        const count = (saleFilterCount.get(sale.id) || 0) + 1
        saleFilterCount.set(sale.id, count)
      }
      result = result.concat(differenceBy(marketplaceSales, savedSales, 'id') as any[])
    }
    continuation = salesData.continuation
    if (!continuation) getMoreSalesData = false
  }

  result = result.filter(sale => saleFilterCount.get(sale.id) === 1)
  await repositories.marketplaceSale.saveMany(result, { chunk: 4000 })

  result = [
    ...result,
    ...savedSales,
  ]

  return result
}
