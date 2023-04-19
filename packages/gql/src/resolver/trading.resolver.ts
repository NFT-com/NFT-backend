import { BigNumber, ethers } from 'ethers'
import { combineResolvers } from 'graphql-resolvers'
import Joi from 'joi'

import { appError, marketBidError, marketListingError } from '@nftcom/error-types'
import { Context } from '@nftcom/misc'
import { auth, joi, pagination } from '@nftcom/misc'
import { core, nftService, searchEngineService, sendgrid, txActivityService } from '@nftcom/service'
import { _logger, contracts, db, defs, entity, helper, provider, typechain, utils as dbUtils } from '@nftcom/shared'
import * as Sentry from '@sentry/node'

import {
  convertAssetInput,
  getAssetList,
  gql,
  parseContractsFromNativeAsset,
  parseNFTIdsFromNativeAsset,
} from '../defs'
import * as auctionUtils from '../helper/utils'

const logger = _logger.Factory(_logger.Context.MarketAsk, _logger.Context.GraphQL)
const seService = searchEngineService.SearchEngineService()

const getListings = (_: any, args: gql.QueryGetListingsArgs, ctx: Context): Promise<gql.GetOrders> => {
  const { repositories } = ctx
  logger.debug('getListings', { input: args?.input })
  const chainId = args?.input.chainId || process.env.CHAIN_ID
  auth.verifyAndGetNetworkChain('ethereum', chainId)
  const pageInput = args?.input?.pageInput
  const { makerAddress } = helper.safeObject(args?.input)

  const filter: Partial<entity.TxOrder> = helper.removeEmpty({
    makerAddress: ethers.utils.getAddress(makerAddress),
    exchange: defs.ExchangeType.NFTCOM,
    orderType: defs.ActivityType.Listing,
    protocol: defs.ProtocolType.NFTCOM,
    chainId,
  })
  return core
    .paginatedEntitiesBy(
      repositories.txOrder,
      pageInput,
      [filter],
      [], // relations
    )
    .then(pagination.toPageable(pageInput))
}

export const validListing = async (
  marketListingArgs: gql.MutationCreateMarketListingArgs,
  chainId: string,
): Promise<boolean> => {
  const nftMarketplaceContract = typechain.NftMarketplace__factory.connect(
    contracts.nftMarketplaceAddress(chainId),
    provider.provider(Number(chainId)),
  )

  // STEP 1 basic validation of order structure (if not used before)
  try {
    const result = await nftMarketplaceContract.validateOrder_(
      {
        maker: marketListingArgs?.input.makerAddress,
        makeAssets: getAssetList(marketListingArgs?.input.makeAsset),
        taker: marketListingArgs?.input.takerAddress,
        takeAssets: getAssetList(marketListingArgs?.input.takeAsset),
        salt: marketListingArgs?.input.salt,
        start: marketListingArgs?.input.start,
        end: marketListingArgs?.input.end,
        nonce: marketListingArgs?.input?.nonce,
        auctionType: auctionUtils.auctionTypeToInt(marketListingArgs?.input?.auctionType),
      },
      marketListingArgs?.input.signature.v,
      marketListingArgs?.input.signature.r,
      marketListingArgs?.input.signature.s,
    )

    const calculatedStructHash: string = result?.[1]

    if (marketListingArgs?.input.structHash !== calculatedStructHash) {
      logger.debug('calculatedStructHash: ', calculatedStructHash)
      logger.debug('marketListingArgs?.input.structHash: ', calculatedStructHash)

      return Promise.reject(
        new Error(
          `calculated structHash ${calculatedStructHash} doesn't match input structHash ${marketListingArgs?.input.structHash}`,
        ),
      )
    }

    if (!result[0]) {
      logger.debug('result[0]: ', result[0])
      return Promise.reject(
        new Error(`provided signature ${JSON.stringify(marketListingArgs.input.signature)} doesn't match`),
      )
    }
  } catch (err) {
    Sentry.captureMessage(`Order validation error: ${err}`)
    return false
  }

  return true
}

const availableToCreateListing = async (
  address: string,
  assets: Array<gql.MarketplaceAssetInput>,
  repositories: db.Repository,
): Promise<boolean> => {
  const now = new Date()
  const listingOrders = await repositories.txOrder.find({
    where: {
      makerAddress: ethers.utils.getAddress(address),
      orderType: defs.ActivityType.Listing,
      exchange: defs.ExchangeType.NFTCOM,
      protocol: defs.ProtocolType.NFTCOM,
    },
  })

  const filteredOrders = listingOrders.filter(
    order => !order.protocolData.acceptedAt && !order.protocolData.swapTransactionId,
  )
  if (!filteredOrders.length) return true

  const NonFungibleAssetAsset = ['ERC721']

  logger.debug('==============> assets: ', assets)

  // find out active listingOrders which have user's make asset...
  const activeOrders = filteredOrders.filter(order => {
    if (!order.protocolData.makeAsset) return false
    if (order.activity?.expiration && order.activity?.expiration < now) return false
    else {
      if (assets.length !== order.protocolData.makeAsset?.length) return false
      else {
        assets.forEach((asset, index) => {
          const isERC721 = NonFungibleAssetAsset.includes(asset.standard.assetClass)
          const sameContractAddress =
            ethers.utils.getAddress(asset.standard.contractAddress) ===
            ethers.utils.getAddress(order.protocolData.makeAsset[index].standard.contractAddress)
          const sameTokenId = BigNumber.from(asset.standard.tokenId).eq(
            order.protocolData.makeAsset[index].standard.tokenId,
          )

          if (isERC721 && sameContractAddress && sameTokenId) {
            logger.debug('====> contractAddress', ethers.utils.getAddress(asset.standard.contractAddress))
            logger.debug('====> tokenId', BigNumber.from(asset.standard.tokenId).toString())
            return true
          }
        })

        return false
      }
    }
  })

  logger.debug('==============> active asks: ', JSON.stringify(activeOrders, null, 2))

  return activeOrders.length === 0
}

const createListing = async (
  _: any,
  args: gql.MutationCreateMarketListingArgs,
  ctx: Context,
): Promise<gql.TxListingOrder> => {
  const { user, repositories, wallet } = ctx
  const chainId = args?.input.chainId || process.env.CHAIN_ID
  auth.verifyAndGetNetworkChain('ethereum', chainId)
  logger.debug('createListing', { loggedInUserId: user?.id, input: JSON.stringify(args?.input, null, 2) })
  try {
    const schema = Joi.object().keys({
      chainId: Joi.string().required(),
      structHash: Joi.string().required(),
      nonce: Joi.required().custom(joi.buildBigNumber),
      auctionType: Joi.string().valid('FixedPrice', 'English', 'Decreasing'),
      signature: joi.buildSignatureInputSchema(),
      makerAddress: Joi.string().required(),
      makeAsset: Joi.array()
        .min(1)
        .max(100)
        .items(
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
      takeAsset: Joi.array()
        .min(0)
        .max(100)
        .items(
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
      start: Joi.number().required(),
      end: Joi.number().required(),
      salt: Joi.number().required(),
      message: Joi.string().optional(),
    })
    joi.validateSchema(schema, args?.input)

    const makeAssetInput = args?.input.makeAsset
    const makeAssets = convertAssetInput(makeAssetInput)

    const takeAssetInput = args?.input.takeAsset
    const takeAssets = convertAssetInput(takeAssetInput)

    if (ethers.utils.getAddress(args?.input.makerAddress) !== ethers.utils.getAddress(wallet.address)) {
      return Promise.reject(
        appError.buildForbidden(
          marketListingError.buildMakerAddressNotOwnedMsg(),
          marketListingError.ErrorType.MakerAddressNotOwned,
        ),
      )
    }

    const listing = await repositories.txOrder.findOne({
      where: {
        orderHash: args?.input.structHash,
        chainId,
      },
    })
    if (listing) {
      return Promise.reject(
        appError.buildExists(
          marketListingError.buildMarketListingExistingMsg(),
          marketListingError.ErrorType.MarketListingExisting,
        ),
      )
    }

    const isValid = await validListing(args, chainId)
    if (!isValid) {
      return Promise.reject(
        appError.buildInvalid(
          marketListingError.buildMarketListingInvalidMsg(),
          marketListingError.ErrorType.MarketListingInvalid,
        ),
      )
    }

    const isAvailable = await availableToCreateListing(wallet.address, makeAssets, repositories)
    if (!isAvailable) {
      return Promise.reject(
        appError.buildForbidden(
          marketListingError.buildMarketListingUnavailableMsg(wallet.address),
          marketListingError.ErrorType.MarketListingUnavailable,
        ),
      )
    }
    const nftIds = parseNFTIdsFromNativeAsset(makeAssets)
    const contracts = parseContractsFromNativeAsset(makeAssets)
    const contract = contracts.length === 1 ? contracts[0] : '0x'
    const activity = await txActivityService.activityBuilder(
      defs.ActivityType.Listing,
      args?.input.structHash,
      wallet.address,
      chainId.toString(),
      nftIds,
      contract,
      args?.input.start,
      args?.input.end,
    )
    const listingOrder = await repositories.txOrder.save({
      activity,
      orderHash: args?.input.structHash,
      exchange: defs.ExchangeType.NFTCOM,
      orderType: defs.ActivityType.Listing,
      protocol: defs.ProtocolType.NFTCOM,
      nonce: args?.input.nonce,
      protocolData: {
        makeAsset: makeAssets,
        takeAsset: takeAssets,
        auctionType: args?.input.auctionType,
        signature: args?.input.signature,
        start: args?.input.start,
        end: args?.input.end,
        salt: args?.input.salt,
      },
      makerAddress: ethers.utils.getAddress(args?.input.makerAddress),
      takerAddress: ethers.utils.getAddress(args?.input.takerAddress),
      chainId: wallet.chainId,
      createdInternally: true,
      memo: args?.input.message ?? null,
    })

    await dbUtils.getNFTsFromTxOrders([listingOrder]).then(seService.indexNFTs)

    return {
      id: listingOrder.id,
      orderHash: listingOrder.orderHash,
      nonce: listingOrder.nonce,
      signature: listingOrder.protocolData.signature,
      makerAddress: listingOrder.makerAddress,
      start: listingOrder.activity.timestamp,
      end: listingOrder.activity.expiration,
      salt: listingOrder.protocolData.salt,
      chainId,
      auctionType: listingOrder.protocolData.auctionType,
      memo: listingOrder.memo,
    }
  } catch (err) {
    Sentry.captureMessage(`Error in createListing: ${err}`)
    return err
  }
}

const filterListings = (_: any, args: gql.QueryFilterListingsArgs, _ctx: Context): Promise<gql.GetOrders> => {
  logger.debug('filterAsks', { input: args?.input })
  const schema = Joi.object().keys({
    auctionType: Joi.string().valid('FixedPrice', 'English', 'Decreasing'),
    sortBy: Joi.string().valid('RecentlyCreated', 'RecentlySold', 'EndingSoon', 'Oldest'),
    chainId: Joi.string().optional(),
    pageInput: Joi.any(),
  })
  joi.validateSchema(schema, args?.input)

  const chainId = args?.input.chainId || process.env.CHAIN_ID
  auth.verifyAndGetNetworkChain('ethereum', chainId)
  const { auctionType, sortBy, pageInput } = helper.safeObject(args?.input)

  let orderKey
  let orderDirection
  if (sortBy === 'RecentlyCreated') {
    orderKey = 'createdAt'
    orderDirection = 'DESC'
  } else if (sortBy === 'RecentlySold') {
    orderKey = 'offerAcceptedAt'
    orderDirection = 'DESC'
  } else if (sortBy === 'EndingSoon') {
    orderKey = 'end'
    orderDirection = 'ASC'
  } else if (sortBy === 'Oldest') {
    orderKey = 'createdAt'
    orderDirection = 'ASC'
  }
  logger.log(auctionType, pageInput)
  logger.log(orderKey, orderDirection)
  return null
}

const validOrderMatch = async (
  listing: entity.TxOrder,
  marketBidArgs: gql.MutationCreateMarketBidArgs,
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
        auctionType: auctionUtils.auctionTypeToInt(marketBidArgs.input.auctionType),
      },
      marketBidArgs?.input.signature.v,
      marketBidArgs?.input.signature.r,
      marketBidArgs?.input.signature.s,
    )

    const calculatedStructHash: string = result?.[1]

    if (marketBidArgs?.input.structHash !== calculatedStructHash) {
      throw Error(
        `calculated structHash ${calculatedStructHash} doesn't match input structHash ${marketBidArgs?.input.structHash}`,
      )
    }
  } catch (err) {
    logger.error('order validation error: ', err)

    Sentry.captureMessage(`Order validation error: ${err}`)
    return false
  }

  // STEP 2 cross validation between listing and potential bid
  try {
    // check time match
    const currentUnixSec = Math.floor(new Date().getTime() / 1000)

    const askStart = Math.floor(listing.activity.timestamp.getTime() / 1000)
    const askEnd = Math.floor(listing.activity.expiration.getTime() / 1000)
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

    // make sure listing taker is valid for Bid
    const listingTaker = listing.takerAddress
    if (
      !(
        listingTaker == helper.AddressZero() ||
        listingTaker == '0x' ||
        helper.checkSum(listingTaker) == helper.checkSum(marketBidArgs?.input.makerAddress)
      )
    ) {
      throw Error(`Bidder ${marketBidArgs?.input.makerAddress} not equal to Listing owner's Taker ${listingTaker}`)
    }

    // make sure assets match via contract
    const result = await validationLogicContract.validateMatch_(
      {
        maker: listing.makerAddress,
        makeAssets: getAssetList(listing.protocolData.makeAsset),
        taker: listing.takerAddress,
        takeAssets: getAssetList(listing.protocolData.takeAsset),
        salt: listing.protocolData.salt,
        start: askStart,
        end: askEnd,
        nonce: listing.nonce,
        auctionType: auctionUtils.auctionTypeToInt(listing.protocolData.auctionType),
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
        auctionType: auctionUtils.auctionTypeToInt(marketBidArgs?.input.auctionType),
      },
      listing.makerAddress,
      false,
    )

    if (!result) {
      throw Error('Market Bid does not match with Market Listing')
    }
  } catch (err) {
    logger.error('order matching validation error: ', err)

    Sentry.captureMessage(`Order matching validation error: ${err}`)
    return false
  }

  return true
}

const ownedProfileOrGK = async (address: string, chainId: string): Promise<boolean> => {
  try {
    const gkOwners = await nftService.getOwnersOfGenesisKeys(chainId)
    const exists = gkOwners[ethers.utils.getAddress(address)]
    if (exists) return true
    const profileOwners = await nftService.getOwnersOfNFTProfile(chainId)
    return profileOwners[ethers.utils.getAddress(address)]
  } catch (err) {
    logger.error('error in ownedProfileOrGK: ', err)
    throw err
  }
}

const createBid = async (_: any, args: gql.MutationCreateMarketBidArgs, ctx: Context): Promise<gql.TxBidOrder> => {
  const { user, repositories, wallet } = ctx
  const chainId = args?.input.chainId || process.env.CHAIN_ID
  auth.verifyAndGetNetworkChain('ethereum', chainId)
  logger.debug('createBid', { loggedInUserId: user?.id, input: JSON.stringify(args?.input, null, 2) })
  try {
    const schema = Joi.object().keys({
      chainId: Joi.string().required(),
      structHash: Joi.string().required(),
      nonce: Joi.required().custom(joi.buildBigNumber),
      auctionType: Joi.string().valid('FixedPrice', 'English', 'Decreasing'),
      signature: joi.buildSignatureInputSchema(),
      listingId: Joi.string().required(),
      makerAddress: Joi.string().required(),
      makeAsset: Joi.array()
        .min(1)
        .max(100)
        .items(
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
      takeAsset: Joi.array()
        .min(0)
        .max(100)
        .items(
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
      start: Joi.number().required(),
      end: Joi.number().required(),
      salt: Joi.number().required(),
      message: Joi.string().optional(),
    })
    joi.validateSchema(schema, args?.input)

    const makeAssetInput = args?.input.makeAsset
    const makeAssets = convertAssetInput(makeAssetInput)

    const takeAssetInput = args?.input.takeAsset
    const takeAssets = convertAssetInput(takeAssetInput)

    if (ethers.utils.getAddress(args?.input.makerAddress) !== ethers.utils.getAddress(wallet.address)) {
      return Promise.reject(
        appError.buildForbidden(
          marketBidError.buildMakerAddressNotOwnedMsg(),
          marketBidError.ErrorType.MakerAddressNotOwned,
        ),
      )
    }

    const listing = await repositories.txOrder.findById(args?.input.listingId)
    if (!listing) {
      return Promise.reject(
        appError.buildForbidden(
          marketBidError.buildMarketListingNotFoundMsg(),
          marketBidError.ErrorType.MarketListingNotFound,
        ),
      )
    }

    const isValid = await validOrderMatch(listing, args, wallet)
    if (!isValid) {
      return Promise.reject(
        appError.buildInvalid(marketBidError.buildMarketBidInvalidMsg(), marketBidError.ErrorType.MarketBidInvalid),
      )
    }

    const isAvailable = await ownedProfileOrGK(args?.input.makerAddress, chainId)
    if (!isAvailable) {
      return Promise.reject(
        appError.buildInvalid(
          marketBidError.buildMakerNotOwnedProfileOrGK(args?.input.makerAddress),
          marketBidError.ErrorType.MakerNotOwnedProfileOrGK,
        ),
      )
    }

    let bidOrder = await repositories.txOrder.findOne({
      where: {
        orderHash: args?.input.structHash,
      },
    })
    if (bidOrder) {
      return Promise.reject(
        appError.buildExists(marketBidError.buildMarketBidExistingMsg(), marketBidError.ErrorType.MarketBidExisting),
      )
    }
    const nftIds = parseNFTIdsFromNativeAsset(makeAssets)
    const contracts = parseContractsFromNativeAsset(makeAssets)
    const contract = contracts.length === 1 ? contracts[0] : '0x'
    const activity = await txActivityService.activityBuilder(
      defs.ActivityType.Bid,
      args?.input.structHash,
      wallet.address,
      chainId,
      nftIds,
      contract,
      args?.input.start,
      args?.input.end,
    )
    bidOrder = await repositories.txOrder.save({
      activity,
      orderHash: args?.input.structHash,
      exchange: defs.ExchangeType.NFTCOM,
      orderType: defs.ActivityType.Bid,
      protocol: defs.ProtocolType.NFTCOM,
      nonce: args?.input.nonce,
      protocolData: {
        makeAsset: makeAssets,
        takeAsset: takeAssets,
        listingId: args?.input.listingId,
        auctionType: args?.input.auctionType,
        signature: args?.input.signature,
        salt: args?.input.salt,
        start: args?.input.start,
        end: args?.input.end,
      },
      makerAddress: ethers.utils.getAddress(args?.input.makerAddress),
      takerAddress: ethers.utils.getAddress(args?.input.takerAddress),
      chainId: wallet.chainId,
      memo: args?.input.message ?? null,
      createdInternally: true,
    })

    const listingWallet = await repositories.wallet.findByChainAddress(chainId, listing.makerAddress)
    const listingUser = await repositories.user.findById(listingWallet.userId)
    await sendgrid.sendMarketplaceBidConfirmEmail(bidOrder.makerAddress, listingUser)
    return {
      id: bidOrder.id,
      orderHash: bidOrder.orderHash,
      nonce: bidOrder.nonce,
      signature: bidOrder.protocolData.signature,
      makerAddress: bidOrder.makerAddress,
      takerAddress: bidOrder.takerAddress,
      start: bidOrder.activity.timestamp,
      end: bidOrder.activity.expiration,
      salt: bidOrder.protocolData.salt,
      chainId,
      auctionType: bidOrder.protocolData.auctionType,
      memo: bidOrder.memo,
    }
  } catch (err) {
    Sentry.captureMessage(`Error in createBid: ${err}`)
    return err
  }
}

const getBids = (_: any, args: gql.QueryGetBidsArgs, ctx: Context): Promise<gql.GetOrders> => {
  const { repositories } = ctx
  logger.debug('getBids', { input: args?.input })
  const chainId = args?.input.chainId || process.env.CHAIN_ID
  auth.verifyAndGetNetworkChain('ethereum', chainId)
  const pageInput = args?.input?.pageInput
  const { makerAddress } = helper.safeObject(args?.input)

  const filter: Partial<entity.TxOrder> = helper.removeEmpty({
    makerAddress: ethers.utils.getAddress(makerAddress),
    exchange: defs.ExchangeType.NFTCOM,
    orderType: defs.ActivityType.Bid,
    protocol: defs.ProtocolType.NFTCOM,
    listingId: args?.input.listingOrderId,
    chainId,
  })
  return core
    .paginatedEntitiesBy(
      repositories.txOrder,
      pageInput,
      [filter],
      [], // relations
    )
    .then(pagination.toPageable(pageInput))
}

export default {
  Query: {
    getListings,
    filterListings,
    getBids,
  },
  Mutation: {
    createMarketListing: combineResolvers(auth.isAuthenticated, createListing),
    createMarketBid: combineResolvers(auth.isAuthenticated, createBid),
  },
}
