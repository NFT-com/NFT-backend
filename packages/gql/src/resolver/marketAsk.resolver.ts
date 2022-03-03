import { BigNumber } from 'ethers'
import { combineResolvers } from 'graphql-resolvers'
import Joi from 'joi'

import { Context, convertAssetInput, getAssetList, gql } from '@nftcom/gql/defs'
import { appError, marketAskError } from '@nftcom/gql/error'
import { _logger, contracts, entity, fp, helper, provider, typechain } from '@nftcom/shared'

import { auth, joi, pagination, utils } from '../helper'
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

const filterAsksForNft = (
  contract: string,
  tokenId: number,
) => {
  return (asks: entity.MarketAsk[]) => {
    const filtered = asks.filter((ask: entity.MarketAsk) => {
      const matchingMakeAsset = ask.makeAsset.find((asset) => {
        return asset?.standard?.contractAddress === contract &&
          asset?.standard?.tokenId === String(tokenId)
      })
      return matchingMakeAsset != null
    })
    return filtered
  }
}

const getNFTAsks = (
  _: any,
  args: gql.QueryGetNFTAsksArgs,
  ctx: Context,
): Promise<gql.MarketAsk[]> => {
  const { repositories } = ctx
  logger.debug('getNFTAsks', { input: args?.input })
  const { makerAddress, nftContractAddress, nftTokenId } = helper.safeObject(args?.input)
  const filter: Partial<entity.MarketAsk> = helper.removeEmpty({
    makerAddress,
  } as Partial<entity.MarketAsk>)
  return repositories.marketAsk.find({ where: filter })
    .then(fp.thruIfEmpty(() => []))
    .then(filterAsksForNft(nftContractAddress, BigNumber.from(nftTokenId).toNumber()))
}

const validAsk = async (
  marketAskArgs: gql.MutationCreateAskArgs,
  wallet: entity.Wallet,
): Promise<boolean> => {
  const nftMarketplaceContract = typechain.NftMarketplace__factory.connect(
    contracts.nftMarketplaceAddress(wallet.chainId),
    provider.provider(wallet.chainId),
  )

  // STEP 1 basic validation of order structure (if not used before)
  try {
    const result = await nftMarketplaceContract.validateOrder_(
      {
        maker: marketAskArgs?.input.makerAddress,
        makeAssets: getAssetList(marketAskArgs?.input.makeAsset),
        taker: marketAskArgs?.input.takerAddress,
        takeAssets: getAssetList(marketAskArgs?.input.takeAsset),
        salt: marketAskArgs?.input.salt,
        start: marketAskArgs?.input.start,
        end: marketAskArgs?.input.end,
        nonce: marketAskArgs?.input?.nonce,
        auctionType: utils.auctionTypeToInt(marketAskArgs?.input?.auctionType),
      },
      marketAskArgs?.input.signature.v,
      marketAskArgs?.input.signature.r,
      marketAskArgs?.input.signature.s,
    )

    const calculatedStructHash: string = result?.[1]

    if (marketAskArgs?.input.structHash !== calculatedStructHash) {
      throw Error(`calculated structHash ${calculatedStructHash} doesn't match input structHash ${marketAskArgs?.input.structHash}`)
    }

    if (!result[0]) {
      throw Error(`provided signature ${JSON.stringify(marketAskArgs.input.signature)} doesn't match`)
    }
  } catch (err) {
    logger.error('order validation error: ', err)
    return false
  }

  return true
}

const cancelAsk = (
  _: any,
  args: gql.MutationCancelAskArgs,
  ctx: Context,
): Promise<boolean> => {
  const { user, repositories, wallet } = ctx
  logger.debug('cancelAsk', { loggedInUserId: user?.id, askId: args?.askId })
  return repositories.marketAsk.findById(args.askId)
    .then(fp.rejectIfEmpty(
      appError.buildNotFound(
        marketAskError.buildMarketAskNotFoundMsg(args.askId),
        marketAskError.ErrorType.MarketAskNotFound,
      ),
    ))
    .then(fp.rejectIf((ask: entity.MarketAsk) => ask.makerAddress !== wallet.address)(
      appError.buildForbidden(
        marketAskError.buildMarketAskNotOwnedMsg(),
        marketAskError.ErrorType.MarketAskNotOwned,
      ),
    ))
    .then(fp.tap((ask: entity.MarketAsk) => {
      repositories.marketBid.delete({
        marketAskId: ask.id,
      })
    }))
    .then((ask: entity.MarketAsk) => {
      repositories.marketAsk.delete({ id: ask.id })
    })
    .then(() => true)
    .catch(() => false)
}

const createAsk = (
  _: any,
  args: gql.MutationCreateAskArgs,
  ctx: Context,
): Promise<gql.MarketAsk> => {
  const { user, repositories, wallet } = ctx
  logger.debug('createAsk', { loggedInUserId: user?.id, input: args?.input })

  const schema = Joi.object().keys({
    chainId: Joi.string().required(),
    structHash: Joi.string().required(),
    nonce: Joi.required().custom(joi.buildBigNumber),
    auctionType: Joi.string().valid('FixedPrice', 'English', 'Decreasing'),
    signature: joi.buildSignatureInputSchema(),
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
    takeAsset: Joi.array().min(0).max(100).items(
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
    start: Joi.number().required(),
    end: Joi.number().required(),
    salt: Joi.number().required(),
  })
  joi.validateSchema(schema, args?.input)

  const makeAssetInput = args?.input.makeAsset
  const makeAssets = convertAssetInput(makeAssetInput)

  const takeAssetInput = args?.input.takeAsset
  const takeAssets = convertAssetInput(takeAssetInput)

  // structHash should be unique
  return repositories.marketAsk
    .findOne({ where: { structHash: args?.input.structHash } })
    .then(fp.rejectIfNotEmpty((appError.buildInvalid(
      marketAskError.buildMarketAskInvalidMsg(),
      marketAskError.ErrorType.MarketAskInvalid,
    ))))
    .then(() => validAsk(args, wallet))
    .then(fp.rejectIfFalse((appError.buildInvalid(
      marketAskError.buildMarketAskInvalidMsg(),
      marketAskError.ErrorType.MarketAskInvalid,
    ))))
    .then(() => repositories.marketAsk.save({
      structHash: args?.input.structHash,
      nonce: args?.input.nonce,
      auctionType: args?.input.auctionType,
      signature: args?.input.signature,
      makerAddress: args?.input.makerAddress,
      makeAsset: makeAssets,
      takerAddress: args?.input.takerAddress,
      takeAsset: takeAssets,
      start: args?.input.start,
      end: args?.input.end,
      salt: args?.input.salt,
      chainId: wallet.chainId,
    }))
}

// TODOs
// 1. add more advanced filters (sort by price, sort by floor)
// 2. filter asks from a single user (walletId or address)
// 3. filter private orders (designated takerAddress)
// 4. show all marketAsk / marketBid, even if NFT is not in wallet -> to allow user to cancel
//      -> front end to show if signature has enough balance
// 5. get singular ASK (show all bids for a single ask)

export default {
  Query: {
    getAsks: getAsks,
    getNFTAsks: getNFTAsks,
  },
  Mutation: {
    createAsk: combineResolvers(auth.isAuthenticated, createAsk),
    cancelAsk: combineResolvers(auth.isAuthenticated, cancelAsk),
  },
}
