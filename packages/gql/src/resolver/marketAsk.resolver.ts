import { combineResolvers } from 'graphql-resolvers'
import Joi from 'joi'

import { Context, gql } from '@nftcom/gql/defs'
import { _logger, entity, helper } from '@nftcom/shared'
import { AssetClass } from '@nftcom/shared/defs'

import { auth, joi, pagination } from '../helper'
import { core } from '../service'

const logger = _logger.Factory(_logger.Context.MarketAsk, _logger.Context.GraphQL)

const getAsks = (
  _: any,
  args: gql.QueryGetAsksArgs,
  ctx: Context,
): Promise<gql.GetMarketAsk> => {
  const { repositories } = ctx
  logger.debug('getAsks', { input: args?.input })
  const pageInput = args?.input?.pageInput
  const { makerAddress } = helper.safeObject(args?.input)

  const filter: Partial<entity.MarketAsk> = helper.removeEmpty({
    makerAddress: makerAddress,
  })
  return core.paginatedEntitiesBy(
    repositories.marketAsk,
    pageInput,
    filter,
  )
    .then(pagination.toPageable(pageInput))
}

const createAsk = (
  _: any,
  args: gql.MutationCreateAskArgs,
  ctx: Context,
): Promise<gql.MarketAsk> => {
  const { user, repositories } = ctx
  logger.debug('createAsk', { loggedInUserId: user?.id, input: args?.input })

  const schema = Joi.object().keys({
    makerAddress: Joi.string().required(),
    makeAsset: Joi.array().min(1).max(100).items(
      Joi.object().keys({
        standard: Joi.object().keys({
          assetClass: Joi.string().required(),
          bytes: Joi.string().required(),
          contractAddress: Joi.string().required(),
          tokenId: Joi.string().required(),
          allowAll: Joi.boolean().required(),
        }),
        bytes: Joi.string().required(),
        value: Joi.number().required(),
        minimumBid: Joi.number().required(),
      }),
    ),
    start: Joi.string().required(),
    end: Joi.string().required(),
    chainId: Joi.string().required(),
  })
  joi.validateSchema(schema, args?.input)

  const makeAssetInput = args?.input.makeAsset
  const makeAssets = []
  makeAssetInput.map((asset) => {
    makeAssets.push({
      standard: {
        assetClass: asset.standard.assetClass as AssetClass,
        bytes: asset.standard.bytes,
        contractAddress: asset.standard.contractAddress,
        tokenId: asset.standard.tokenId,
        allowAll: asset.standard.allowAll,
      },
      bytes: asset.bytes,
      value: asset.bytes,
      minimumBid: asset.minimumBid,
    })
  })

  return repositories.marketAsk.save({
    makerAddress: args?.input.makerAddress,
    makeAsset: makeAssets,
    start: args?.input.start,
    end: args?.input.end,
  })
}

export default {
  Query: {
    getAsks: getAsks,
  },
  Mutation: {
    createAsk: combineResolvers(auth.isAuthenticated, createAsk),
  },
}
