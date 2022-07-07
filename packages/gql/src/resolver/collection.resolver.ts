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
    const key = `${args?.input?.contract?.toLowerCase()}-${args?.input?.chainId}-${args?.input?.withOpensea}`
    const cachedData = await redis.get(key)
    
    if (cachedData) {
      return JSON.parse(cachedData)
    } else {
      let stats, data

      if (args?.input?.withOpensea) {
        const slugKey = `${key}-slug`
        const cachedData = JSON.parse(await redis.get(slugKey))
  
        if (cachedData?.collection?.slug) {
          data = cachedData
          stats = await retrieveCollectionStatsOpensea(
            cachedData?.collection?.slug,
            args?.input?.chainId,
          )
        } else {
          data = await retrieveCollectionOpensea(args?.input?.contract, args?.input?.chainId)
    
          if (data) {
            if (data?.collection?.slug) {
              stats = await retrieveCollectionStatsOpensea(
                data?.collection?.slug,
                args?.input?.chainId,
              )
            }
          }
  
          if (data?.collection?.slug) {
            await redis.set(slugKey, JSON.stringify(data)) // set cache
          }
        }
      }

      const returnObject = {
        collection: await ctx.repositories.collection.findByContractAddress(args?.input?.contract),
        openseaInfo: data,
        openseaStats: stats,
      }

      if (args?.input?.withOpensea) {
        if (data && stats) {
          await redis.set(key, JSON.stringify(returnObject), 'EX', 60 * 30)
        }
      } else {
        await redis.set(key, JSON.stringify(returnObject), 'EX', 60 * 5)
      }
  
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