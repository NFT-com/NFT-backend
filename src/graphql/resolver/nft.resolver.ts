import { combineResolvers } from 'graphql-resolvers'
import Joi from 'joi'

import { Context, entity } from '@src/db'
import { gql, misc } from '@src/defs'
import { _logger, helper } from '@src/helper'

import { isAuthenticated } from './auth'
import * as coreService from './core.service'
import { validateSchema } from './joi'

const logger = _logger.Factory(_logger.Context.NFT, _logger.Context.GraphQL)

const getNFT = (
  _: unknown,
  args: gql.QueryNFTArgs,
  ctx: Context,
): Promise<gql.NFT> => {
  const { user, repositories } = ctx
  logger.debug('getNFT', { loggedInUserId: user?.id, input: args })
  const schema = Joi.object().keys({
    id: Joi.string().required(),
  })
  validateSchema(schema, args)
  return repositories.nft.findById(args.id)
}

const getNFTsBy = (ctx: Context, filter: Partial<entity.NFT>): Promise<gql.NFTsOutput> => {
  return coreService.entitiesBy(ctx.repositories.nft, filter, { createdAt: 'DESC' })
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
  logger.debug('getNFTs', { loggedInUserId: user?.id, input: args?.input })
  const { types, profileId } = helper.safeObject(args?.input)
  const filter: Partial<entity.NFT> = helper.removeEmpty({
    type: helper.safeInForOmitBy(types),
    profileId,
  })
  return getNFTsBy(ctx, filter)
}

// TODO implement pagination
const getMyNFTs = (
  _: unknown,
  args: gql.QueryNFTsArgs,
  ctx: Context,
): Promise<gql.NFTsOutput> => {
  const { user } = ctx
  logger.debug('getMyNFTs', { loggedInUserId: user.id, input: args?.input })
  const { types, profileId } = helper.safeObject(args?.input)
  const filter: Partial<entity.NFT> = helper.removeEmpty({
    type: helper.safeInForOmitBy(types),
    userId: user.id,
    profileId,
  })
  return getNFTsBy(ctx, filter)
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
