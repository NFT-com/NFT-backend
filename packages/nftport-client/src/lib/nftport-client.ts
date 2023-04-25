import { snakeCase } from 'lodash'
import { format } from 'node:util'
import { stringify } from 'qs'

import { cache } from '@nftcom/cache'
import { appError } from '@nftcom/error-types'
import { _logger } from '@nftcom/shared'

import { getNFTPortInterceptor } from './nftport-interceptor'

const logger = _logger.Factory('nftport-client', _logger.Context.GraphQL)

const NFTPORT_API_BASE_URL = 'https://api.nftport.xyz/v0'
const NFTPORT_ENDPOINTS = {
  nfts: '/nfts/%s/%s',
  stats: '/transactions/stats/%s',
  txByContract: '/transactions/nfts/%s',
  txByNFT: '/transactions/nfts/%s/%s',
}

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
        return {
          data: {
            response: 'OK',
          },
        }
      }
      logger.error(error.request, `Request failed to ${url}`)
    } else {
      logger.error(`Error: ${error.message}`, `Request failed to ${url}`)
    }
    throw appError.buildInternal()
  }
}

export type FetchDataOpts = {
  extraHeaders?: { [key: string]: string }
  queryParams?: any
  cacheSeconds?: number
}
export const fetchData = async (endpoint: string, args: string[], opts: FetchDataOpts = {}): Promise<any> => {
  try {
    const { extraHeaders = {}, queryParams = {}, cacheSeconds } = opts
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
        cacheSeconds || 60 * 60, // 60 minutes
      )
    } else {
      logger.error(data, `Unsuccessful response from ${url}`)
    }

    return data
  } catch (error) {
    logger.error(error, `Error fetching data from NFTPort with url = ${format(NFTPORT_ENDPOINTS[endpoint], ...args)}`)
    throw error
  }
}
