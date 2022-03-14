import { combineResolvers } from 'graphql-resolvers'

import { Context, gql } from '@nftcom/gql/defs'
import { auth } from '@nftcom/gql/helper'
import { core } from '@nftcom/gql/service'
import { _logger, defs, entity, fp } from '@nftcom/shared'

const logger = _logger.Factory(_logger.Context.Watchlist, _logger.Context.GraphQL)

const getWatchlistItems = (ctx: Context): Promise<gql.Watchlist> => {
  const { user } = ctx

  const getNFTs = (): Promise<entity.NFT[]> => {
    return core.thatEntitiesOfEdgesBy<entity.NFT>(ctx, {
      thisEntityId: user.id,
      thisEntityType: defs.EntityType.User,
      edgeType: defs.EdgeType.Watches,
    })
  }

  const getProfiles = (): Promise<entity.Profile[]> => {
    return core.thatEntitiesOfEdgesBy<entity.Profile>(ctx, {
      thisEntityId: user.id,
      thisEntityType: defs.EntityType.User,
      edgeType: defs.EdgeType.Watches,
    })
  }

  const getCollections = (): Promise<entity.Collection[]> => {
    return core.thatEntitiesOfEdgesBy<entity.Collection>(ctx, {
      thisEntityId: user.id,
      thisEntityType: defs.EntityType.User,
      edgeType: defs.EdgeType.Watches,
    })
  }

  return Promise.all([
    getNFTs(),
    getProfiles(),
    getCollections(),
  ])
    .then(([nftItems, profileItems, collectionItems]) => {
      return {
        nftItems,
        profileItems,
        collectionItems,
      }
    })
}

const getWatchlist = (_: any, args: any, ctx: Context): Promise<gql.Watchlist> => {
  const { user } = ctx
  logger.debug('getWatchlist', { loggedInUserId: user.id, input: args })

  return getWatchlistItems(ctx)
}

const createWatchEdge = (args: gql.WatchlistInput, ctx: Context): Promise<boolean> => {
  const { user, repositories } = ctx
  const { itemId, itemType } = args

  return repositories.edge.exists({
    thisEntityId: user.id,
    edgeType: defs.EdgeType.Watches,
    thatEntityId: itemId,
    deletedAt: null,
  })
    .then(fp.thruIfFalse(() =>
      core.createEdge(ctx, {
        thisEntityId: user.id,
        thisEntityType: defs.EntityType.User,
        edgeType: defs.EdgeType.Watches,
        thatEntityId: itemId,
        thatEntityType: defs.EntityType[itemType],
      }),
    ))
}

const addToWatchlist = (_: any, args: gql.WatchlistInput, ctx: Context): Promise<boolean> => {
  const { user } = ctx
  logger.debug('addToWatchlist', { loggedInUserId: user.id, input: args })

  return createWatchEdge(args, ctx)
}

const deleteFromWatchlist = (_: any, args: gql.WatchlistInput, ctx: Context): Promise<boolean> => {
  const { user, repositories } = ctx
  const { itemId, itemType } = args
  logger.debug('deleteFromWatchlist', { loggedInUserId: user.id, input: args })
  
  return repositories.edge.delete({
    thisEntityId: user.id,
    edgeType: defs.EdgeType.Watches,
    thatEntityId: itemId,
    thatEntityType: defs.EntityType[itemType],
    deletedAt: null,
  })
}

export default {
  Query: {
    watchlist: combineResolvers(auth.isAuthenticated, getWatchlist),
  },
  Mutation: {
    addToWatchlist: combineResolvers(auth.isAuthenticated, addToWatchlist),
    deleteFromWatchlist: combineResolvers(auth.isAuthenticated, deleteFromWatchlist),
  },
}
