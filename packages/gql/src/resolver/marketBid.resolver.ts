import { combineResolvers } from 'graphql-resolvers'
import Joi from 'joi'

import { Context, gql } from '@nftcom/gql/defs'
import { appError, marketBidError } from '@nftcom/gql/error'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { _logger, contracts, entity, fp, helper, provider, typechain } from '@nftcom/shared'

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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getAssetList = (assets: any): any => {
  return assets.map((asset: any) => {
    return {
      assetType: {
        assetClass: asset[0],
        data: helper.encode(asset[1], asset[2]),
      },
      data: helper.encode(['uint256', 'uint256'], asset[3]),
    }
  })
}

const validOrderMatch = async (
  marketAsk: entity.MarketAsk,
  marketBidArgs: gql.MutationCreateBidArgs,
  wallet: entity.Wallet,
): Promise<boolean> => {
  const nftMarketplaceContract = typechain.NftMarketplace__factory.connect(
    contracts.nftMarketplaceAddress(wallet.chainId),
    provider.provider(Number(wallet.chainId)),
  )

  // STEP 1 basic validation of order structure (if not used before)
  try {
    const result = await nftMarketplaceContract.validateOrder_(
      {
        maker: marketBidArgs?.input.makerAddress,
        makeAssets: getAssetList(marketBidArgs?.input.makeAsset),
        taker: marketBidArgs?.input.takerAddress || helper.AddressZero,
        takeAssets: getAssetList(marketBidArgs?.input.makeAsset),
        salt: marketBidArgs?.input.salt,
        start: marketBidArgs?.input.start,
        end: marketBidArgs?.input.end,
      },
      marketBidArgs?.input.signature.v,
      marketBidArgs?.input.signature.r,
      marketBidArgs?.input.signature.s,
    )

    console.log('result: ', result)

    if (marketBidArgs?.input.structHash == result[1]) {
      console.log('structHash matches')
    } else {
      throw Error('structHash mismatch')
    }
  } catch (err) {
    logger.error('order validation error: ', err)
    return false
  }

  // STEP 2 cross validation between marketAsk and potential marketBid
  try {
    // check time match
    
    // make sure marketAsk is not expired
    // make sure marketAsk taker is valid for Bid
    // make sure assets match
  } catch (err) {
    logger.error('order matching validation error: ', err)
    return false
  }

  return true
}

const createBid = (
  _: any,
  args: gql.MutationCreateBidArgs,
  ctx: Context,
): Promise<gql.MarketBid> => {
  const { user, repositories, wallet } = ctx
  logger.debug('createBid', { loggedInUserId: user?.id, input: args?.input })

  const schema = Joi.object().keys({
    structHash: Joi.string().required(),
    signature: joi.buildSignatureInputSchema(),
    marketAskId: Joi.string().required(),
    makerAddress: Joi.string().required(),
    makeAsset: Joi.array().min(1).max(100).items(
      Joi.object().keys({
        standard: Joi.object().keys({
          assetClass: Joi.string().valid('ETH', 'ERC20', 'ERC721', 'ERC1155'),
          bytes: Joi.string().required(),
          contractAddress: Joi.string().required(),
          tokenId: Joi.required().custom(joi.buildBigNumber),
          allowAll: Joi.boolean().required(),
        }),
        bytes: Joi.string().required(),
        value: Joi.required().custom(joi.buildBigNumber),
        minimumBid: Joi.required().custom(joi.buildBigNumber),
      }),
    ),
    takerAddress: Joi.string().required(),
    takeAsset: Joi.array().min(1).max(100).items(
      Joi.object().keys({
        standard: Joi.object().keys({
          assetClass: Joi.string().valid('ETH', 'ERC20', 'ERC721', 'ERC1155'),
          bytes: Joi.string().required(),
          contractAddress: Joi.string().required(),
          tokenId: Joi.required().custom(joi.buildBigNumber),
          allowAll: Joi.boolean().required(),
        }),
        bytes: Joi.string().required(),
        value: Joi.required().custom(joi.buildBigNumber),
        minimumBid: Joi.required().custom(joi.buildBigNumber),
      }),
    ),
    message: Joi.string().optional(),
    start: Joi.string().required(),
    end: Joi.string().required(),
    salt: Joi.number().required(),
  })
  joi.validateSchema(schema, args?.input)

  const makeAssetInput = args?.input.makeAsset
  const makeAssets = helper.convertAssetInput(makeAssetInput)

  const takeAssetInput = args?.input.takeAsset
  const takeAssets = helper.convertAssetInput(takeAssetInput)

  return repositories.marketAsk.findById(args?.input.marketAskId)
    .then(fp.rejectIf((marketAsk: entity.MarketAsk) => !marketAsk)(appError.buildInvalid(
      marketBidError.buildMarketAskNotFoundMsg(),
      marketBidError.ErrorType.MarketAskNotFound,
    )))
    .then(fp.rejectIf((marketAsk: entity.MarketAsk) =>
      !validOrderMatch(marketAsk, args, wallet))(appError.buildInvalid(
      marketBidError.buildMarketBidInvalidMsg(),
      marketBidError.ErrorType.MarketBidInvalid,
    )))
    .then(() => repositories.marketBid.save({
      structHash: args?.input.structHash,
      signature: args?.input.signature,
      marketAskId: args?.input.marketAskId,
      makerAddress: args?.input.makerAddress,
      makeAsset: makeAssets,
      takerAddress: args?.input.takerAddress,
      takeAsset: takeAssets,
      message: args?.input.message,
      start: args?.input.start,
      end: args?.input.end,
      salt: args?.input.salt,
      chainId: wallet.chainId,
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
