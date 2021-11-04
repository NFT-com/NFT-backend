import { combineResolvers } from 'graphql-resolvers'

import { Context, entity } from '@src/db'
import { gql, misc } from '@src/defs'
import { _logger, helper } from '@src/helper'

import { isAuthenticated } from './auth'
import * as coreService from './core.service'

const logger = _logger.Factory(_logger.Context.GraphQL, _logger.Context.NFT)

const getNFTsBy = (ctx: Context, filter: Partial<entity.NFT>): Promise<gql.NFTsOutput> => {
  return coreService.entitiesBy(ctx.repositories.nft, filter)
    .then((nfts) => ({
      nfts,
      pageInfo: null,
    }))
}

// TODO implement pagination
const getNFTs = (
  _: any,
  args: gql.QueryNFTsArgs,
  ctx: Context,
): Promise<gql.NFTsOutput> => {
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
  args: gql.QueryNFTsArgs,
  ctx: Context,
): Promise<gql.NFTsOutput> => {
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
    wallet: coreService.resolveEntityById(
      'walletId',
      misc.EntityType.NFT,
      misc.EntityType.Wallet,
    ),
    isOwnedByMe: coreService.resolveEntityOwnership(
      'userId',
      'user',
      misc.EntityType.NFT,
    ),
  },
}
