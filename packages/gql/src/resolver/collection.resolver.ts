import axios from 'axios'
import Redis from 'ioredis'

import { redisConfig } from '@nftcom/gql/config'
import { Context, gql } from '@nftcom/gql/defs'
import { _logger } from '@nftcom/shared'
import * as Sentry from '@sentry/node'
const logger = _logger.Factory(_logger.Context.Collection, _logger.Context.GraphQL)

const OPENSEA_API_KEY = process.env.OPENSEA_API_KEY
const V1_OPENSEA_API_TESTNET_BASE_URL = 'https://testnets-api.opensea.io/api/v1'
const V1_OPENSEA_API_BASE_URL = 'https://api.opensea.io/api/v1'

const redis = new Redis({
  host: redisConfig.host,
  port: redisConfig.port,
})

const getCollection = async (
  _: any,
  args: gql.QueryCollectionArgs,
  ctx: Context,
): Promise<gql.CollectionInfo> => {
  try {
    logger.debug('getCollection', { input: args?.input })
    const key = JSON.stringify({
      contract: args?.input?.contract?.toLowerCase(),
      chainId: args?.input?.chainId,
    })

    const cachedData = await redis.get(key)

    if (cachedData) {
      return JSON.parse(cachedData)
    } else {
      const baseUrl = args?.input?.chainId === '4' ? V1_OPENSEA_API_TESTNET_BASE_URL : V1_OPENSEA_API_BASE_URL

      const config = args?.input?.chainId === '4' ? {
        headers: { Accept: 'application/json' },
      } :  {
        headers: {
          Accept: 'application/json',
          'X-API-KEY': OPENSEA_API_KEY,
        },
      }
  
      let data, stats
  
      const url = `${baseUrl}/asset_contract/${args?.input?.contract}`
      const res = await axios.get(url, config)
  
      if (res && res.data) {
        data = res.data as gql.OpenseaContract
  
        if (data?.collection?.slug) {
          const statsUrl = `${baseUrl}/collection/${data?.collection?.slug}/stats`
          const res2 = await axios.get(statsUrl, config)
  
          if (res2 && res2.data) {
            stats = res2.data as gql.OpenseaStats
          }
        }
      }

      const returnObject = {
        collection: await ctx.repositories.collection.findByContractAddress(args?.input?.contract),
        openseaInfo: data,
        openseaStats: stats,
      }

      redis.set(key, JSON.stringify(returnObject), 'EX', 60 * 5) // 5 minutes cache
  
      return returnObject
    }
  } catch (err) {
    Sentry.captureException(err)
    Sentry.captureMessage(`Error in getCollection: ${err}`)
  }
}

export default {
  Query: {
    collection: getCollection,
  },
}