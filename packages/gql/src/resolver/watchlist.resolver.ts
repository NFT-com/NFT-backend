import { FindOptionsWhere, IsNull } from 'typeorm'

import { Context, gql } from '@nftcom/gql/defs'
import { core } from '@nftcom/gql/service'
import { defs, entity, fp } from '@nftcom/shared'

// const logger = _logger.Factory(_logger.Context.Watchlist, _logger.Context.GraphQL)

const getWatchlistItems = (ctx: Context, args: gql.QueryWatchlistArgs): Promise<gql.Watchlist> => {
  const { userId } = args
  const watchEdge: Partial<entity.Edge> = {
    thisEntityId: userId, // replace with user.id from context when auth is added
    thisEntityType: defs.EntityType.User,
    edgeType: defs.EdgeType.Watches,
  }

  const getWatchedNFTs = (): Promise<entity.NFT[]> =>
    core.thatEntitiesOfEdgesBy<entity.NFT>(ctx, {
      ...watchEdge,
      thatEntityType: defs.EntityType.NFT,
    })
  const getWatchedProfiles = (): Promise<entity.Profile[]> =>
    core.thatEntitiesOfEdgesBy<entity.Profile>(ctx, {
      ...watchEdge,
      thatEntityType: defs.EntityType.Profile,
    })
  const getWatchedCollections = (): Promise<entity.Collection[]> =>
    core.thatEntitiesOfEdgesBy<entity.Collection>(ctx, {
      ...watchEdge,
      thatEntityType: defs.EntityType.Collection,
    })

  return Promise.all([getWatchedNFTs(), getWatchedProfiles(), getWatchedCollections()]).then(
    ([nftItems, profileItems, collectionItems]) => ({
      nftItems,
      profileItems,
      collectionItems,
    }),
  )
}

const getWatchlist = (_: any, args: gql.QueryWatchlistArgs, ctx: Context): Promise<gql.Watchlist> => {
  // place back when auth is added
  // const { user } = ctx
  // logger.debug('getWatchlist', { loggedInUserId: user.id, input: args })

  return getWatchlistItems(ctx, args)
}

const createWatchEdge = (args: gql.MutationAddToWatchlistArgs, ctx: Context): Promise<boolean> => {
  const { repositories } = ctx
  const { userId, itemId, itemType } = args.input
  const watchEdge: FindOptionsWhere<entity.Edge> = {
    thisEntityId: userId, // replace with user.id from context when auth is added
    thisEntityType: defs.EntityType.User,
    edgeType: defs.EdgeType.Watches,
    thatEntityId: itemId,
    thatEntityType: defs.EntityType[itemType],
    deletedAt: IsNull(),
  }

  return repositories.edge
    .exists(watchEdge)
    .then(
      fp.thruIfFalse(() => {
        const watchEdgeEntity = { ...watchEdge, deletedAt: null } as entity.Edge
        return repositories.edge.save(watchEdgeEntity)
      }),
    )
    .then(() => true)
}

const addToWatchlist = (_: any, args: gql.MutationAddToWatchlistArgs, ctx: Context): Promise<boolean> => {
  // place back when auth is added
  // const { user } = ctx
  // logger.debug('addToWatchlist', { loggedInUserId: user.id, input: args })

  return createWatchEdge(args, ctx)
}

const deleteFromWatchlist = (_: any, args: gql.MutationDeleteFromWatchlistArgs, ctx: Context): Promise<boolean> => {
  const { repositories } = ctx
  // place back when auth is added
  // logger.debug('deleteFromWatchlist', { loggedInUserId: user.id, input: args })
  const { userId, itemId, itemType } = args.input
  const watchEdge: FindOptionsWhere<entity.Edge> = {
    thisEntityId: userId, // replace with user.id from context when auth is added
    thisEntityType: defs.EntityType.User,
    edgeType: defs.EdgeType.Watches,
    thatEntityId: itemId,
    thatEntityType: defs.EntityType[itemType],
    deletedAt: IsNull(),
  }

  return repositories.edge.exists(watchEdge).then(fp.thruIfTrue(() => repositories.edge.delete(watchEdge)))
}

export default {
  Query: {
    watchlist: getWatchlist,
  },
  Mutation: {
    addToWatchlist,
    deleteFromWatchlist,
  },
}
