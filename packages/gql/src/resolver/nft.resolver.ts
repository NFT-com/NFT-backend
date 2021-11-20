import { combineResolvers } from 'graphql-resolvers'
import Joi from 'joi'

import { Context, gql } from '@nftcom/gql/defs'
import { auth, joi } from '@nftcom/gql/helper'
import { core } from '@nftcom/gql/service'
import { _logger, defs, entity, helper } from '@nftcom/shared'

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
  joi.validateSchema(schema, args)
  return repositories.nft.findById(args.id)
}

const getNFTsBy = (ctx: Context, filter: Partial<entity.NFT>): Promise<gql.NFTsOutput> => {
  return core.entitiesBy(ctx.repositories.nft, filter, { createdAt: 'DESC' })
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
    myNFTs: combineResolvers(auth.isAuthenticated, getMyNFTs),
  },
  NFT: {
    wallet: core.resolveEntityById<gql.NFT, entity.Wallet>(
      'walletId',
      defs.EntityType.NFT,
      defs.EntityType.Wallet,
    ),
    isOwnedByMe: core.resolveEntityOwnership<gql.NFT>(
      'userId',
      'user',
      defs.EntityType.NFT,
    ),
  },
}
