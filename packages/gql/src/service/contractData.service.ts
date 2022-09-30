import crypto from 'crypto'
import { parseISO } from 'date-fns'
import isBefore from 'date-fns/isBefore'
import sub from 'date-fns/sub'
import { Contract, utils } from 'ethers'
import { differenceBy,snakeCase } from 'lodash'
import { stringify } from 'qs'
import { MoreThanOrEqual } from 'typeorm'
import { format } from 'util'

import { getNFTPortInterceptor } from '@nftcom/gql/adapter'
import { appError } from '@nftcom/gql/error'
import { cache } from '@nftcom/gql/service/cache.service'
import { db, provider, typechain } from '@nftcom/shared'
import { _logger } from '@nftcom/shared'
import { MarketplaceSale } from '@nftcom/shared/db/entity'

const NFTPORT_API_BASE_URL = 'https://api.nftport.xyz/v0'
const NFTPORT_ENDPOINTS = {
  nfts: '/nfts/%s/%s',
  stats: '/transactions/stats/%s',
  txByContract: '/transactions/nfts/%s',
  txByNFT: '/transactions/nfts/%s/%s',
}

const logger = _logger.Factory('ContractDataService', _logger.Context.GraphQL)

const repositories = db.newRepositories()

const getCacheKey = (endpoint: string, args: string[], continuation?: string, pageSize?: string): string => {
  return `${snakeCase(endpoint)}_${args.join('_')}_${continuation || ''}_${pageSize || ''}`
}

const sendRequest = async (url: string, extraHeaders = {}, queryParams = {}): Promise<any> => {
  const nftInterceptor = getNFTPortInterceptor(NFTPORT_API_BASE_URL)
  try {
    return await nftInterceptor.get(url, {
      params: {
        chain: 'ethereum',
        ...queryParams,
      },
      paramsSerializer: function (params) {
        return stringify(params, { arrayFormat: 'repeat' })
      },
      headers: extraHeaders,
    })
  } catch (error) {
    if (error.response) {
      const { config, data, headers, status, request } = error.response
      logger.error(
        {
          data,
          headers,
          status,
          params: config.params,
          url: `${config.url}${request.path}`,
        },
        `Request failed to ${url}`,
      )
      if (status >= 400 && status < 500) {
        throw appError.buildInvalid(data.error.message, 'BAD_REQUEST')
      }
    } else if (error.request) {
      if (error.response.status === 404) {
        return { data: {
          response: 'OK',
        } }
      }
      logger.error(error.request, `Request failed to ${url}`)
    } else {
      logger.error(`Error: ${error.message}`, `Request failed to ${url}`)
    }
    throw appError.buildInternal()
  }
}

export const fetchData = async (
  endpoint: string,
  args: string[],
  extraHeaders = {},
  queryParams = {} as any,
): Promise<any> => {
  const key = getCacheKey(endpoint, args, queryParams.continuation, queryParams.page_size)
  const cachedData = await cache.get(key)
  if (cachedData) {
    return JSON.parse(cachedData)
  }
  const url = format(NFTPORT_ENDPOINTS[endpoint], ...args)
  const { data } = await sendRequest(url, extraHeaders, queryParams)
  if (data.response === 'OK') {
    await cache.set(
      key,
      JSON.stringify(data),
      'EX',
      60 * 60 * 72, // 60 minutes
    )
  } else {
    logger.error(data, `Unsuccessful response from ${url}`)
  }

  return data
}

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

const getTxId = (tx): string => {
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
    }
    cache.set(key, symbol)
  }
  return symbol
}
const getSymbol = async (tx): Promise<string> => {
  const assetType = tx.price_details.asset_type
  return assetType === 'ETH' ? assetType : await getSymbolForContract(tx.price_details.contract_address)
}
const transformTxns = async (txns: any[]): Promise<any> => {
  const transformed = []
  for (const tx of txns) {
    transformed.push({
      id: getTxId(tx),
      priceUSD: tx.price_details.price_usd,
      price: tx.price_details.price,
      symbol: await getSymbol(tx),
      date: parseISO(tx.transaction_date),
      contractAddress: utils.getAddress(tx.nft.contract_address),
      tokenId: tx.nft.token_id,
      transaction: tx,
    } as MarketplaceSale)
  }
  return transformed
}

export const getSalesData = async (
  contractAddress: string,
  dateRange = 'all',
  tokenId: string = undefined,
): Promise<MarketplaceSale[]> => {
  const endpoint = tokenId ? 'txByNFT' : 'txByContract'
  const args = [contractAddress, tokenId].filter((x) => !!x) // not falsey
  let continuation: string
  let oldestTransactionDate =
    dateRange === 'all'
      ? new Date('2015-07-30T00:00:00') // ETH release date
      : sub(new Date(), parseDateRangeForDateFns(dateRange))
  let salesData = { transactions: [] } as any,
    filteredTxns = [],
    result: MarketplaceSale[] = []
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
  const savedSales = await repositories.marketplaceSale.find({
    where: {
      ...whereOptions,
    },
    order: {
      date: 'DESC',
    },
  })

  if (savedSales.length) {
    oldestTransactionDate = savedSales[0].date
  }

  let getMoreSalesData = true
  const txnsFilterCount = new Map() // count txnIds because NFTPort data can be bad
  while (getMoreSalesData) {
    salesData = await fetchData(endpoint, args, {}, { chain: 'ethereum', type: 'sale', continuation })
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
      const mpSales = await transformTxns(filteredTxns)
      for (const txn of mpSales) {
        const count = (txnsFilterCount.get(txn.id) || 0) + 1
        txnsFilterCount.set(txn.id, count)
      }
      result = result.concat(differenceBy(mpSales, savedSales, 'id') as any[])
    }
    continuation = salesData.continuation
    if (!continuation) getMoreSalesData = false
  }

  result = result.filter(ms => txnsFilterCount.get(ms.id) === 1)
  await repositories.marketplaceSale.saveMany(result, { chunk: 4000 })

  result = [
    ...result,
    ...savedSales,
  ]

  return result
}
