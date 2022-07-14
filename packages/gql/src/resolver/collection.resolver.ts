import { combineResolvers } from 'graphql-resolvers'

import { Context, gql } from '@nftcom/gql/defs'
import { auth } from '@nftcom/gql/helper'
import { cache } from '@nftcom/gql/service/cache.service'
import {
  retrieveCollectionOpensea,
  retrieveCollectionStatsOpensea,
} from '@nftcom/gql/service/opensea.service'
import { _logger, defs } from '@nftcom/shared'
import * as Sentry from '@sentry/node'
const logger = _logger.Factory(_logger.Context.Collection, _logger.Context.GraphQL)

const MAX_SAVE_COUNTS = 500

const getCollection = async (
  _: any,
  args: gql.QueryCollectionArgs,
  ctx: Context,
): Promise<gql.CollectionInfo> => {
  try {
    logger.debug('getCollection', { input: args?.input })
    const key = `${args?.input?.contract?.toLowerCase()}-${args?.input?.chainId}-${args?.input?.withOpensea}`
    const cachedData = await cache.get(key)

    if (cachedData) {
      return JSON.parse(cachedData)
    } else {
      let stats, data

      if (args?.input?.withOpensea) {
        const slugKey = `${key}-slug`
        const cachedData = JSON.parse(await cache.get(slugKey))

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

          await cache.set(slugKey, JSON.stringify(data), 'EX', 60 * 5) // set cache
        }
      }

      const returnObject = {
        collection: await ctx.repositories.collection.findByContractAddress(args?.input?.contract),
        openseaInfo: data,
        openseaStats: stats,
      }

      await cache.set(key, JSON.stringify(returnObject), 'EX', 60 * (args?.input?.withOpensea ? 30 : 5))

      return returnObject
    }
  } catch (err) {
    Sentry.captureMessage(`Error in getCollection: ${err}`)
  }
}

const removeCollectionDuplicates = async (
  _: any,
  args: gql.MutationRemoveDuplicatesArgs,
  ctx: Context,
): Promise<gql.RemoveDuplicatesOutput> => {
  const { repositories } = ctx
  logger.debug('removeCollectionDuplicates', { contracts: args?.contracts })
  try {
    const { contracts } = args
    let removedDuplicates = false
    await Promise.allSettled(
      contracts.map(async (contract) => {
        const collections = await repositories.collection.find({ where: { contract: contract } })
        if (collections.length > 1) {
          const toRemove = collections.slice(1, collections.length)
          await Promise.allSettled(
            toRemove.map(async (collection) => {
              const edgeVals = {
                thisEntityType: defs.EntityType.Collection,
                thatEntityType: defs.EntityType.NFT,
                thisEntityId: collection.id,
                edgeType: defs.EdgeType.Includes,
              }
              const edges = await repositories.edge.find({ where: edgeVals })
              if (edges.length) {
                const updatedEdges = []
                for (let i = 0; i < edges.length; i++) {
                  updatedEdges.push({
                    id: edges[i].id,
                    thisEntityId: collections[0].id,
                  })
                }
                await repositories.edge.saveMany(updatedEdges, { chunk: MAX_SAVE_COUNTS })
              }
            }),
          )
          const removeIds = toRemove.map((collection) => collection.id)
          await repositories.collection.hardDeleteByIds(removeIds)
          removedDuplicates = true
        }
      }),
    )
    return removedDuplicates ? { message: 'Removed collection duplicates' } : { message: 'No duplicates found' }
  } catch (err) {
    Sentry.captureException(err)
    Sentry.captureMessage(`Error in removeCollectionDuplicates: ${err}`)
  }
}

export default {
  Query: {
    collection: getCollection,
  },
  Mutation: {
    removeDuplicates: combineResolvers(auth.isAuthenticated, removeCollectionDuplicates),
  },
}
