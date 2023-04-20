import { parseISO } from 'date-fns'
import isBefore from 'date-fns/isBefore'
import sub from 'date-fns/sub'
import { utils } from 'ethers'
import { differenceBy } from 'lodash'
import crypto from 'node:crypto'
import { MoreThanOrEqual } from 'typeorm'

import { fetchData } from '@nftcom/nftport-client'
import { db, entity } from '@nftcom/shared'

import { getSymbolForContract } from './erc20-util'

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
  return hmac.update(`${tx.transaction_hash}-${tx.buyer_address}-${tx.seller_address}-${tx.nft.token_id}`).digest('hex')
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
    } as entity.MarketplaceSale)
  }
  return transformed
}

const retrievePersistedSales = async (
  contractAddress: string,
  oldestTransactionDate: Date,
  tokenId: string,
): Promise<entity.MarketplaceSale[]> => {
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

const determineOldestTransactionDateForCollectionUpdate = (
  now: Date,
  tokenId: string,
  savedSales: entity.MarketplaceSale[],
): Date => {
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
): Promise<entity.MarketplaceSale[]> => {
  const endpoint = tokenId ? 'txByNFT' : 'txByContract'
  const args = [contractAddress, tokenId].filter(x => !!x) // not falsey
  const now = new Date()

  let oldestTransactionDate =
    dateRange === 'all'
      ? new Date('2015-07-30T00:00:00') // ETH release date
      : sub(now, parseDateRangeForDateFns(dateRange))

  let salesData = { transactions: [] } as any,
    filteredTxns = [],
    result: entity.MarketplaceSale[] = [],
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
        filteredTxns = salesData.transactions.filter(tx => tx.type === 'sale')
      } else {
        filteredTxns = salesData.transactions.filter(tx => {
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

  result = [...result, ...savedSales]

  return result
}
