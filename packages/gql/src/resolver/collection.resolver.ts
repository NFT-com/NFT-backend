import Redis from 'ioredis'

import { redisConfig } from '@nftcom/gql/config'
import { Context, gql } from '@nftcom/gql/defs'
import {
  retrieveCollectionOpensea,
  retrieveCollectionStatsOpensea,
} from '@nftcom/gql/service/opensea.service'
import { _logger } from '@nftcom/shared'
import * as Sentry from '@sentry/node'
const logger = _logger.Factory(_logger.Context.Collection, _logger.Context.GraphQL)

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
      const data = await retrieveCollectionOpensea(args?.input?.contract, args?.input?.chainId)
      let stats
  
      if (data) {
        if (data?.collection?.slug) {
          stats = await retrieveCollectionStatsOpensea(
            data?.collection?.slug,
            args?.input?.chainId,
          )
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