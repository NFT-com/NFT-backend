import axios from 'axios'
import { minTime, parseISO } from 'date-fns'
import isAfter from 'date-fns/isAfter'
import sub from 'date-fns/sub'
import { snakeCase } from 'lodash'
import { stringify } from 'qs'
import { format } from 'util'

import { cache } from '@nftcom/gql/service/cache.service'
import { _logger } from '@nftcom/shared/helper'

import { appError } from '../error'

const NFTPORT_KEY = process.env.NFTPORT_KEY || ''

const NFTPORT_ENDPOINTS = {
  nfts: 'https://api.nftport.xyz/v0/nfts/%s/%s',
  stats: 'https://api.nftport.xyz/v0/transactions/stats/%s',
  txByContract: 'https://api.nftport.xyz/v0/transactions/nfts/%s',
  txByNFT: 'https://api.nftport.xyz/v0/transactions/nfts/%s/%s',
}

const logger = _logger.Factory('ContractDataService', _logger.Context.GraphQL)

const getCacheKey = (endpoint: string, args: string[], continuation?: string, pageSize?: string): string => {
  return `${snakeCase(endpoint)}_${args.join('_')}_${continuation || ''}_${pageSize || ''}`
}

const sendRequest = async (url: string, extraHeaders = {}, queryParams = {}): Promise<any> => {
  try {
    return await axios.get(url, {
      params: {
        chain: 'ethereum',
        ...queryParams,
      },
      paramsSerializer: function (params) {
        return stringify(params, { arrayFormat: 'repeat' })
      },
      headers: {
        Authorization: NFTPORT_KEY,
        'Content-Type': 'application/json',
        ...extraHeaders,
      },
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
      60 * 60, // 60 minutes
    )
  } else {
    logger.error(data, `Unsuccessful response from ${url}`)
  }

  return data
}

const durationMap = {
  y: 'years',
  d: 'days',
  h: 'hours',
}
const parseDateRangeForDateFns = (dateRange: string): { [duration: string]: number } => {
  return {
    [durationMap[dateRange.slice(-1)]]: parseInt(dateRange.slice(0, -1)),
  }
}

const transformTxns = (txns: any[]): any => {
  const transformed = []
  for (const tx of txns) {
    transformed.push({
      priceUSD: tx.price_details.price_usd,
      date: parseISO(tx.transaction_date),
      transactionHash: tx.transaction_hash,
      transaction: tx,
    })
  }
  return transformed
}

export const getSalesData = async (contractAddress: string, dateRange = 'all', tokenId: string): Promise<any> => {
  const endpoint = tokenId ? 'txByNFT' : 'txByContract'
  const args = [contractAddress, tokenId].filter((x) => x !== undefined)
  let continuation: string
  const oldestTransactionDate =
    dateRange === 'all'
      ? new Date(minTime)
      : sub(new Date(), parseDateRangeForDateFns(dateRange))
  let salesData = { transactions: [] } as any,
    filteredTxns = [],
    result = []
  let getMoreSalesData = true
  while (getMoreSalesData) {
    salesData = await fetchData(endpoint, args, {}, { chain: 'ethereum', type: 'sale', continuation })
    if (
      isAfter(
        parseISO(salesData.transactions[salesData.transactions.length - 1].transaction_date),
        oldestTransactionDate,
      )
    ) {
      filteredTxns = salesData.transactions.filter((tx) => tx.type === 'sale')
    } else {
      filteredTxns = salesData.transactions.filter((tx) => {
        return tx.type === 'sale' && isAfter(parseISO(tx.transaction_date), oldestTransactionDate)
      })
      getMoreSalesData = false
    }
    result = result.concat(transformTxns(filteredTxns))
    continuation = salesData.continuation
    if (!continuation) getMoreSalesData = false
  }
  return result
}
