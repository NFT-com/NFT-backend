import { combineResolvers } from 'graphql-resolvers'
import Joi from 'joi'
import { isEmpty,omitBy } from 'lodash'

import { Context, entity } from '@src/db'
import { gql, misc } from '@src/defs'
import { _logger, helper } from '@src/helper'

import { isAuthenticated } from './auth'
import * as coreService from './core.service'
import { validateSchema } from './joi'

const logger = _logger.Factory(_logger.Context.GraphQL, _logger.Context.NFT)

const getNFT = (
  _: unknown,
  args: gql.QueryNFTArgs,
  ctx: Context,
): Promise<gql.NFT> => {
  const { user, repositories } = ctx
  logger.debug('getNFT', { loggedInUserId: user.id, input: args })
  const schema = Joi.object().keys({
    id: Joi.string().required(),
  })
  validateSchema(schema, args)
  return repositories.nft.findById(args.id)
}

const getNFTsBy = (ctx: Context, filter: Partial<entity.NFT>): Promise<gql.NFTsOutput> => {
  return coreService.entitiesBy(ctx.repositories.nft, filter)
    .then((nfts) => ({
      nfts,
      pageInfo: null,
    }))
}

// TODO implement pagination
const getNFTs = (
  p: unknown,
  args: gql.QueryNFTsArgs,
  ctx: Context,
): Promise<gql.NFTsOutput> => {
  const { user } = ctx
  logger.debug('getNFTs', { loggedInUserId: user.id, input: args.input })

  const { types, profileId } = args.input
  const filter: Partial<entity.NFT> = omitBy({
    type: helper.safeIn(types),
    profileId,
  }, isEmpty)

  return getNFTsBy(ctx, filter)
}

// TODO implement pagination
const getMyNFTs = (
  _: unknown,
  args: gql.QueryNFTsArgs,
  ctx: Context,
): Promise<gql.NFTsOutput> => {
  const { user } = ctx
  logger.debug('getMyNFTs', { loggedInUserId: user.id, input: args.input })
  return getNFTsBy(ctx, { userId: user.id })
}

export default {
  Query: {
    nft: getNFT,
    nfts: getNFTs,
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
