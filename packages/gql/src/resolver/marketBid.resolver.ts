import { combineResolvers } from 'graphql-resolvers'
import Joi from 'joi'

import { Context, convertAssetInput, getAssetList, gql } from '@nftcom/gql/defs'
import { appError, marketBidError } from '@nftcom/gql/error'
import { _logger, contracts, entity, fp, helper, provider, typechain } from '@nftcom/shared'

import { auth, joi, pagination, utils } from '../helper'
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
  const { makerAddress, marketAskId } = helper.safeObject(args?.input)

  const filter: Partial<entity.MarketBid> = helper.removeEmpty({
    makerAddress,
    marketAskId,
  })
  return core.paginatedEntitiesBy(
    repositories.marketBid,
    pageInput,
    filter,
  )
    .then(pagination.toPageable(pageInput))
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
        taker: marketBidArgs?.input.takerAddress,
        takeAssets: getAssetList(marketBidArgs?.input.makeAsset),
        salt: marketBidArgs?.input.salt,
        start: marketBidArgs?.input.start,
        end: marketBidArgs?.input.end,
        nonce: marketBidArgs?.input.nonce,
        auctionType: utils.auctionTypeToInt(marketBidArgs.input.auctionType),
      },
      marketBidArgs?.input.signature.v,
      marketBidArgs?.input.signature.r,
      marketBidArgs?.input.signature.s,
    )

    const calculatedStructHash: string = result?.[1]

    if (marketBidArgs?.input.structHash !== calculatedStructHash) {
      throw Error(`calculated structHash ${calculatedStructHash} doesn't match input structHash ${marketBidArgs?.input.structHash}`)
    }
  } catch (err) {
    logger.error('order validation error: ', err)
    return false
  }

  // STEP 2 cross validation between marketAsk and potential marketBid
  try {
    // check time match
    const currentUnixSec = Math.floor(new Date().getTime() / 1000)

    const askStart = Number(marketAsk.start)
    const askEnd = Number(marketAsk.end)
    const bidStart = Number(marketBidArgs?.input.start)
    const bidEnd = Number(marketBidArgs?.input.end)

    // TODO: make sure logic is sound...
    // Reference logic in smart contract -> LibSignature.validate
    if (!(askStart == 0 || askStart < currentUnixSec)) {
      throw Error(`Invalid Market Ask Start: ${askStart}`)
    } else if (!(bidStart == 0 || bidStart < currentUnixSec)) {
      throw Error(`Invalid Market Bid Start: ${bidStart}`)
    } else if (!(askEnd == 0 || askEnd > currentUnixSec)) {
      throw Error(`Invalid Market Ask End: ${askEnd}`)
    } else if (!(bidEnd == 0 || bidEnd > currentUnixSec)) {
      throw Error(`Invalid Market Bid End: ${bidEnd}`)
    }

    // make sure marketAsk taker is valid for Bid
    const askTaker = marketAsk.takerAddress
    if (
      !(askTaker == helper.AddressZero() ||
      helper.checkSum(askTaker) == helper.checkSum(marketBidArgs?.input.makerAddress))
    ) {
      throw Error(`Bidder ${marketBidArgs?.input.makerAddress} not equal to Maker's Taker ${askTaker}`)
    }

    // make sure assets match via contract
    const result = await nftMarketplaceContract.validateMatch_(
      {
        maker: marketAsk.makerAddress,
        makeAssets: getAssetList(marketAsk.makeAsset),
        taker: marketAsk.takerAddress,
        takeAssets: getAssetList(marketAsk.takeAsset),
        salt: marketAsk.salt,
        start: marketAsk.start,
        end: marketAsk.end,
        nonce: marketAsk.nonce,
        auctionType: utils.auctionTypeToInt(marketAsk.auctionType),
      },
      {
        maker: marketBidArgs?.input.makerAddress,
        makeAssets: getAssetList(marketBidArgs?.input.makeAsset),
        taker: marketBidArgs?.input.takerAddress,
        takeAssets: getAssetList(marketBidArgs?.input.takeAsset),
        salt: marketBidArgs?.input.salt,
        start: marketBidArgs?.input.start,
        end: marketBidArgs?.input.end,
        nonce: marketBidArgs?.input.nonce,
        auctionType: utils.auctionTypeToInt(marketBidArgs?.input.auctionType),
      },
    )

    if (!result) {
      throw Error('Market Bid does not match with Market Ask')
    }
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
    nonce: Joi.required().custom(joi.buildBigNumber),
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
    start: Joi.number().required(),
    end: Joi.number().required(),
    salt: Joi.number().required(),
  })
  joi.validateSchema(schema, args?.input)

  const makeAssetInput = args?.input.makeAsset
  const makeAssets = convertAssetInput(makeAssetInput)

  const takeAssetInput = args?.input.takeAsset
  const takeAssets = convertAssetInput(takeAssetInput)

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
      nonce: args?.input.nonce,
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

const cancelMarketBid = (
  _: any,
  args: gql.MutationCancelMarketBidArgs,
  ctx: Context,
): Promise<boolean> => {
  const { user, repositories, wallet } = ctx
  logger.debug('cancelBid', { loggedInUserId: user?.id, bidId: args?.input.marketBidId })
  return repositories.marketBid.findById(args?.input.marketBidId)
    .then(fp.rejectIfEmpty(
      appError.buildNotFound(
        marketBidError.buildMarketBidNotFoundMsg(args?.input.marketBidId),
        marketBidError.ErrorType.MarketBidNotFound,
      ),
    ))
    .then(fp.rejectIf((bid: entity.MarketBid) => bid.makerAddress !== wallet.address)(
      appError.buildForbidden(
        marketBidError.buildMarketBidNotOwnedMsg(),
        marketBidError.ErrorType.MarketBidNotOwned,
      ),
    ))
    .then((bid: entity.MarketBid) => {
      const chain = provider.provider(bid.chainId)
      chain.getTransaction(args?.input.txHash)
        .then(() =>  {
          repositories.marketBid.updateOneById(bid.id, { cancelTxHash: args?.input.txHash })
        })
        .catch(() => false)
    })
    .then(() => true)
    .catch(() => false)
}

export default {
  Query: {
    getBids,
  },
  Mutation: {
    createBid: combineResolvers(auth.isAuthenticated, createBid),
    cancelMarketBid: combineResolvers(auth.isAuthenticated, cancelMarketBid),
  },
}
