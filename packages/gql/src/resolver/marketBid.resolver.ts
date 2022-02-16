import { combineResolvers } from 'graphql-resolvers'
import Joi from 'joi'

import { Context, gql } from '@nftcom/gql/defs'
import { appError, marketBidError } from '@nftcom/gql/error'
import { _logger, entity, fp, helper, typechain } from '@nftcom/shared'
import { AssetClass } from '@nftcom/shared/defs'

import { auth, joi, pagination } from '../helper'
import { core } from '../service'

const logger = _logger.Factory(_logger.Context.MarketBid, _logger.Context.GraphQL)

const getBids = (
  _: any,
  args: gql.QueryGetBidsArgs,
  ctx: Context,
): Promise<gql.GetMarketBid> => {
  const { repositories } = ctx
  logger.debug('getBids', { input: args?.input })
  const pageInput = args?.input?.pageInput
  const { makerAddress } = helper.safeObject(args?.input)

  const filter: Partial<entity.MarketBid> = helper.removeEmpty({
    makerAddress: makerAddress,
  })
  return core.paginatedEntitiesBy(
    repositories.marketBid,
    pageInput,
    filter,
  )
    .then(pagination.toPageable(pageInput))
}

// estimateGas, if > 5000000, reject
// TODO: typechain call
// function executeSwap(
//     LibSignature.Order calldata sellOrder,
//     LibSignature.Order calldata buyOrder,
//     uint8[2] calldata v,
//     bytes32[2] calldata r,
//     bytes32[2] calldata s
// }
const executionRevertSwap = (
  marketAsk: entity.MarketAsk,
  marketBidArgs: gql.MutationCreateBidArgs,
): boolean => {
  logger.debug('marketAsk: ', marketAsk)
  logger.debug('marketBidArgs: ', marketBidArgs)
  logger.debug('typechain: ', typechain)
  
  return false
}

const createBid = (
  _: any,
  args: gql.MutationCreateBidArgs,
  ctx: Context,
): Promise<gql.MarketBid> => {
  const { user, repositories } = ctx
  logger.debug('createBid', { loggedInUserId: user?.id, input: args?.input })

  const schema = Joi.object().keys({
    structHash: Joi.string().required(),
    signature: joi.buildSignatureInputSchema(),
    marketAskId: Joi.string().required(),
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
    message: Joi.string().optional(),
    start: Joi.string().required(),
    end: Joi.string().required(),
    salt: Joi.number().required(),
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
      value: asset.value,
      minimumBid: asset.minimumBid,
    })
  })

  return repositories.marketAsk.findById(args?.input.marketAskId)
    .then(fp.rejectIf((marketAsk: entity.MarketAsk) => !marketAsk)(appError.buildInvalid(
      marketBidError.buildMarketAskNotFoundMsg(),
      marketBidError.ErrorType.MarketAskNotFound,
    )))
    .then(fp.rejectIf((marketAsk: entity.MarketAsk) =>
      !executionRevertSwap(marketAsk, args))(appError.buildInvalid(
      marketBidError.buildMarketBidInvalidMsg(),
      marketBidError.ErrorType.MarketBidInvalid,
    )))
    .then(() => repositories.marketBid.save({
      structHash: args?.input.structHash,
      signature: args?.input.signature,
      marketAskId: args?.input.marketAskId,
      makerAddress: args?.input.makerAddress,
      makeAsset: makeAssets,
      start: args?.input.start,
      end: args?.input.end,
      salt: args?.input.salt,
      chainId: args?.input.chainId,
    }))
}

export default {
  Query: {
    getBids: getBids,
  },
  Mutation: {
    createBid: combineResolvers(auth.isAuthenticated, createBid),
  },
}
