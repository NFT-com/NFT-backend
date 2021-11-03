import { combineResolvers } from 'graphql-resolvers'

import { Context, entity } from '@src/db'
import { EntityType, gqlTypes } from '@src/defs'
import { helper } from '@src/helper'
import { LoggerContext, LoggerFactory } from '@src/helper/logger'

import { isAuthenticated } from './auth'
import * as service from './service'

const logger = LoggerFactory(LoggerContext.GraphQL, LoggerContext.NFT)

const getNFTsBy = (ctx: Context, filter: Partial<entity.NFT>): Promise<gqlTypes.NFTsOutput> => {
  return service.entitiesBy(ctx.repositories.nft, filter)
    .then((nfts) => ({
      nfts,
      pageInfo: null,
    }))
}

// TODO implement pagination
const getNFTs = (
  _: any,
  args: gqlTypes.QueryNFTsArgs,
  ctx: Context,
): Promise<gqlTypes.NFTsOutput> => {
  const { user } = ctx
  logger.debug('getNFTs', { loggedInUserId: user.id, input: args.input })

  const { types } = args.input
  let filter: Partial<entity.NFT> = {}
  if (helper.isNotEmpty(types)) {
    filter = Object.assign({}, filter, { type: helper.safeIn(types) })
  }

  return getNFTsBy(ctx, filter)
}

// TODO implement pagination
const getMyNFTs = (
  _: any,
  args: gqlTypes.QueryNFTsArgs,
  ctx: Context,
): Promise<gqlTypes.NFTsOutput> => {
  const { user } = ctx
  logger.debug('getMyNFTs', { loggedInUserId: user.id, input: args.input })
  return getNFTsBy(ctx, { userId: user.id })
}

export default {
  Query: {
    nfts: combineResolvers(isAuthenticated, getNFTs),
    myNFTs: combineResolvers(isAuthenticated, getMyNFTs),
  },
  NFT: {
    wallet: service.resolveEntityById('walletId', EntityType.NFT, EntityType.Wallet),
    isOwnedByMe: service.resolveEntityOwnership('userId', 'user', EntityType.NFT),
  },
}
