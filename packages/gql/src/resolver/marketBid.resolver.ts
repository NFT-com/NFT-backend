import { ethers } from 'ethers'
import { combineResolvers } from 'graphql-resolvers'
import Joi from 'joi'

import { Context, convertAssetInput, getAssetList, gql } from '@nftcom/gql/defs'
import { appError, marketBidError } from '@nftcom/gql/error'
import { AskOrBid, validateTxHashForCancel } from '@nftcom/gql/resolver/validation'
import { _logger, contracts, entity, fp, helper, provider, typechain } from '@nftcom/shared'
import * as Sentry from '@sentry/node'

import { auth, joi, pagination, utils } from '../helper'
import { core, sendgrid } from '../service'

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

  const filters: Partial<entity.MarketBid>[] = [helper.removeEmpty({
    makerAddress,
    marketAskId,
  })]
  return core.paginatedEntitiesBy(
    repositories.marketBid,
    pageInput,
    filters,
    [], // relations
  )
    .then(pagination.toPageable(pageInput))
}

const validOrderMatch = async (
  marketAsk: entity.MarketAsk,
  marketBidArgs: gql.MutationCreateBidArgs,
  wallet: entity.Wallet,
): Promise<boolean> => {
  const validationLogicContract = typechain.ValidationLogic__factory.connect(
    contracts.validationLogicAddress(wallet.chainId),
    provider.provider(Number(wallet.chainId)),
  )

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
        takeAssets: getAssetList(marketBidArgs?.input.takeAsset),
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

    Sentry.captureMessage(`Order validation error: ${err}`)
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
    const result = await validationLogicContract.validateMatch_(
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
      marketAsk.makerAddress,
      false,
    )

    if (!result) {
      throw Error('Market Bid does not match with Market Ask')
    }
  } catch (err) {
    logger.error('order matching validation error: ', err)

    Sentry.captureMessage(`Order matching validation error: ${err}`)
    return false
  }

  return true
}

// FIXME: add validation later for 1% increase AND marketAskId
// NOTE: currently this is limited every user to 1 active bid per user, not per ask
// const availableToBid = async (
//   address: string,
//   repositories: db.Repository,
// ): Promise<boolean> => {
//   const now = Date.now() / 1000
//   const marketBids = await repositories.marketBid.find({
//     skip: 0,
//     take: 1,
//     order: { createdAt: 'DESC' },
//     where: {
//       makerAddress: ethers.utils.getAddress(address),
//       cancelTxHash: null,
//       marketSwapId: null,
//       rejectedAt: null,
//     },
//   })

//   const activeBids = marketBids.filter((bid) => bid.end >= now)
//   return (activeBids.length === 0)
// }

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
          tokenId: Joi.optional(),
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
          tokenId: Joi.optional(),
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
    chainId: Joi.string().required(),
    auctionType: Joi.string().valid('FixedPrice', 'English', 'Decreasing'),
  })
  joi.validateSchema(schema, args?.input)

  const makeAssetInput = args?.input.makeAsset
  const makeAssets = convertAssetInput(makeAssetInput)

  const takeAssetInput = args?.input.takeAsset
  const takeAssets = convertAssetInput(takeAssetInput)

  if (ethers.utils.getAddress(args?.input.makerAddress) !==
    ethers.utils.getAddress(wallet.address)) {
    return Promise.reject(appError.buildForbidden(
      marketBidError.buildMakerAddressNotOwnedMsg(),
      marketBidError.ErrorType.MakerAddressNotOwned,
    ))
  }

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
    .then((marketAsk: entity.MarketAsk) =>
      repositories.marketBid
        .findOne({ where: { structHash: args?.input.structHash } })
        .then(fp.rejectIfNotEmpty(appError.buildExists(
          marketBidError.buildMarketBidExistingMsg(),
          marketBidError.ErrorType.MarketBidExisting,
        )))
        .then(() => {
          return repositories.marketBid.save({
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
            auctionType: args?.input.auctionType,
          }).then((bid: entity.MarketBid) => {
            return repositories.wallet.findByChainAddress(marketAsk.chainId, marketAsk.makerAddress)
              .then((wallet: entity.Wallet) => {
                return repositories.user.findById(wallet.userId)
                  .then((user: entity.User) => {
                    return sendgrid.sendMarketplaceBidConfirmEmail(bid, user)
                      .then(() => bid)
                  })
              })
          })
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
    .then((bid: entity.MarketBid): Promise<boolean> => {
      return validateTxHashForCancel(
        args?.input.txHash,
        bid.chainId,
        args?.input.marketBidId,
        AskOrBid.Bid,
      ).then((valid) => {
        if (valid) {
          return repositories.marketBid.updateOneById(bid.id, {
            cancelTxHash: args?.input.txHash,
          }).then(() => true)
        } else {
          return Promise.reject(appError.buildInvalid(
            marketBidError.buildTxHashInvalidMsg(args?.input.txHash),
            marketBidError.ErrorType.TxHashInvalid,
          ))
        }
      })
    })
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
