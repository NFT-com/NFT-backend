import { BigNumber, ethers } from 'ethers'
import { combineResolvers } from 'graphql-resolvers'
import Joi from 'joi'
import { IsNull } from 'typeorm'

import { appError, marketBidError, marketListingError } from '@nftcom/error-types'
import { Context, convertAssetInput, getAssetList, gql } from '@nftcom/gql/defs'
import { ListingOrBid, validateTxHashForCancel } from '@nftcom/gql/resolver/validation'
import {
  _logger,
  contracts,
  db,
  defs,
  entity,
  helper,
  provider,
  typechain,
} from '@nftcom/shared'
import * as Sentry from '@sentry/node'

import { auth, joi, pagination, utils } from '../helper'
import { core, sendgrid } from '../service'
import { activityBuilder } from '../service/txActivity.service'

const logger = _logger.Factory(_logger.Context.MarketAsk, _logger.Context.GraphQL)

// interface BuyNowInfo {
//   block: number
//   buyNowTaker: string | null
// }

const getListings = (
  _: any,
  args: gql.QueryGetListingsArgs,
  ctx: Context,
): Promise<gql.GetListingOrders> => {
  const { repositories } = ctx
  logger.debug('getListings', { input: args?.input })
  const chainId = args?.input.chainId || process.env.CHAIN_ID
  auth.verifyAndGetNetworkChain('ethereum', chainId)
  const pageInput = args?.input?.pageInput
  const { makerAddress } = helper.safeObject(args?.input)

  const filter: Partial<entity.TxOrder> = helper.removeEmpty({
    makerAddress: ethers.utils.getAddress(makerAddress),
    exchange: defs.ExchangeType.Marketplace,
    orderType: defs.ActivityType.Listing,
    protocol: defs.ProtocolType.Marketplace,
    chainId,
  })
  return core.paginatedEntitiesBy(
    repositories.txOrder,
    pageInput,
    [filter],
    [], // relations
  )
    .then(pagination.toPageable(pageInput))
}

const filterListingsForNft = (
  listings: entity.TxOrder[],
  contract: string,
  tokenId: string,
): entity.TxOrder[] => {
  return listings.filter((listing: entity.TxOrder) => {
    const matchingMakeAsset = listing.makeAsset.find((asset) => {
      return asset?.standard?.contractAddress === contract &&
        BigNumber.from(asset?.standard?.tokenId).eq(BigNumber.from(tokenId))
    })
    return matchingMakeAsset != null
  })
}

const getNFTListings = async (
  _: any,
  args: gql.QueryGetNFTListingsArgs,
  ctx: Context,
): Promise<gql.TxListingOrder[]> => {
  const { repositories } = ctx
  logger.debug('getNFTListings', { input: args?.input })
  const chainId = args?.input.chainId || process.env.CHAIN_ID
  auth.verifyAndGetNetworkChain('ethereum', chainId)
  const { makerAddress, nftContractAddress, nftTokenId } = helper.safeObject(args?.input)
  const txOrders = await repositories.txOrder.find({
    where: {
      makerAddress: ethers.utils.getAddress(makerAddress),
      exchange: defs.ExchangeType.Marketplace,
      orderType: defs.ActivityType.Listing,
      protocol: defs.ProtocolType.Marketplace,
      chainId,
    },
  })
  const filteredListings = filterListingsForNft(txOrders, ethers.utils.getAddress(nftContractAddress), nftTokenId)
  return filteredListings.map((listing) => {
    return {
      id: listing.id,
      orderHash: listing.orderHash,
      nonce: listing.nonce,
      signature: listing.protocolData.signature,
      makerAddress: listing.makerAddress,
      makeAsset: listing.makeAsset,
      start: listing.activity.timestamp,
      end: listing.activity.expiration,
      salt: listing.protocolData.salt,
      acceptedAt: listing.acceptedAt,
      chainId,
      auctionType: listing.protocolData.auctionType,
    }
  })
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
        auctionType: utils.auctionTypeToInt(marketListingArgs?.input?.auctionType),
      },
      marketListingArgs?.input.signature.v,
      marketListingArgs?.input.signature.r,
      marketListingArgs?.input.signature.s,
    )

    const calculatedStructHash: string = result?.[1]

    if (marketListingArgs?.input.structHash !== calculatedStructHash) {
      logger.debug('calculatedStructHash: ', calculatedStructHash)
      logger.debug('marketListingArgs?.input.structHash: ', calculatedStructHash)

      return Promise.reject(new Error(`calculated structHash ${calculatedStructHash} doesn't match input structHash ${marketListingArgs?.input.structHash}`))
    }

    if (!result[0]) {
      logger.debug('result[0]: ', result[0])
      return Promise.reject(new Error(`provided signature ${JSON.stringify(marketListingArgs.input.signature)} doesn't match`))
    }
  } catch (err) {
    Sentry.captureMessage(`Order validation error: ${err}`)
    return false
  }

  return true
}

const cancelListing = async (
  _: any,
  args: gql.MutationCancelMarketListingArgs,
  ctx: Context,
): Promise<boolean> => {
  const { user, repositories, wallet, chain } = ctx
  const chainId = chain.id || process.env.CHAIN_ID
  auth.verifyAndGetNetworkChain('ethereum', chainId)
  logger.debug('cancelListing', { loggedInUserId: user?.id, input: args?.input })
  try {
    const listingOrder = await repositories.txOrder.findById(args?.input.listingOrderId)
    if (!listingOrder) {
      return Promise.reject(appError.buildNotFound(
        marketListingError.buildMarketListingNotFoundMsg(args?.input.listingOrderId),
        marketListingError.ErrorType.MarketListingNotFound,
      ))
    }
    if (ethers.utils.getAddress(listingOrder.makerAddress) !== ethers.utils.getAddress(wallet.address)) {
      return Promise.reject(appError.buildForbidden(
        marketListingError.buildMarketListingNotOwnedMsg(wallet.address, args?.input.listingOrderId),
        marketListingError.ErrorType.MarketListingNotOwned,
      ))
    }
    const isValid = await validateTxHashForCancel(
      args?.input.txHash,
      listingOrder.chainId,
      args?.input.listingOrderId,
      ListingOrBid.Listing,
    )
    if (!isValid) {
      return Promise.reject(appError.buildInvalid(
        marketListingError.buildTxHashInvalidMsg(args?.input.txHash),
        marketListingError.ErrorType.TxHashInvalid,
      ))
    }
    const txCancel = await repositories.txCancel.findOne({
      where: {
        exchange: defs.ExchangeType.Marketplace,
        foreignType: defs.CancelActivities[0],
        foreignKeyId: listingOrder.orderHash,
        transactionHash: args?.input.txHash,
        chainId,
      },
    })
    if (!txCancel) {
      const chainProvider = provider.provider(Number(chainId))
      const tx = await chainProvider.getTransaction(args?.input.txHash)
      await repositories.txCancel.save({
        activity: listingOrder.activity,
        exchange: defs.ExchangeType.Marketplace,
        foreignType: defs.CancelActivities[0],
        foreignKeyId: listingOrder.orderHash,
        transactionHash: args?.input.txHash,
        blockNumber: tx.blockNumber.toString(),
        chainId,
      })
      const listingActivity = await repositories.txActivity.findById(listingOrder.activity.id)
      await repositories.txActivity.updateOneById(listingActivity.id, { status: defs.ActivityStatus.Cancelled })
    }
    return true
  } catch (err) {
    Sentry.captureMessage(`Error in cancelListing: ${err}`)
    return err
  }
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
      acceptedAt: IsNull(),
      swapTransactionId: IsNull(),
      exchange: defs.ExchangeType.Marketplace,
      orderType: defs.ActivityType.Listing,
      protocol: defs.ProtocolType.Marketplace,
    },
  })

  const NonFungibleAssetAsset = ['ERC721']

  logger.debug('==============> assets: ', assets)

  // find out active listingOrders which have user's make asset...
  const activeOrders = listingOrders.filter((order) => {
    if (order.activity.expiration < now) return false
    else {
      if (assets.length !== order.makeAsset.length) return false
      else {
        assets.forEach((asset, index) => {
          const isERC721 = NonFungibleAssetAsset.includes(asset.standard.assetClass)
          const sameContractAddress = ethers.utils.getAddress(asset.standard.contractAddress) ===
            ethers.utils.getAddress(order.makeAsset[index].standard.contractAddress)
          const sameTokenId = BigNumber.from(asset.standard.tokenId)
            .eq(order.makeAsset[index].standard.tokenId)

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

  return (activeOrders.length === 0)
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
      takeAsset: Joi.array().min(0).max(100).items(
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
    })
    joi.validateSchema(schema, args?.input)

    const makeAssetInput = args?.input.makeAsset
    const makeAssets = convertAssetInput(makeAssetInput)

    const takeAssetInput = args?.input.takeAsset
    const takeAssets = convertAssetInput(takeAssetInput)

    if (ethers.utils.getAddress(args?.input.makerAddress) !==
      ethers.utils.getAddress(wallet.address)) {
      return Promise.reject(appError.buildForbidden(
        marketListingError.buildMakerAddressNotOwnedMsg(),
        marketListingError.ErrorType.MakerAddressNotOwned,
      ))
    }

    const listing = await repositories.txOrder.findOne({
      where: {
        orderHash: args?.input.structHash,
        chainId,
      },
    })
    if (listing) {
      return Promise.reject(appError.buildExists(
        marketListingError.buildMarketListingExistingMsg(),
        marketListingError.ErrorType.MarketListingExisting,
      ))
    }

    const isValid = await validListing(args, chainId)
    if (!isValid) {
      return Promise.reject(appError.buildInvalid(
        marketListingError.buildMarketListingInvalidMsg(),
        marketListingError.ErrorType.MarketListingInvalid,
      ))
    }

    const isAvailable = availableToCreateListing(wallet.address, makeAssets, repositories)
    if (!isAvailable) {
      return Promise.reject(appError.buildForbidden(
        marketListingError.buildMarketListingUnavailableMsg(wallet.address),
        marketListingError.ErrorType.MarketListingUnavailable))
    }
    const activity = await activityBuilder(
      defs.ActivityType.Listing,
      args?.input.structHash,
      wallet.address,
      chainId.toString(),
      [],
      '0x',
      args?.input.start,
      args?.input.end,
    )
    const listingOrder = await repositories.txOrder.save({
      activity,
      orderHash: args?.input.structHash,
      exchange: defs.ExchangeType.Marketplace,
      orderType: defs.ActivityType.Listing,
      protocol: defs.ProtocolType.Marketplace,
      nonce: args?.input.nonce,
      protocolData: {
        auctionType: args?.input.auctionType,
        signature: args?.input.signature,
        salt: args?.input.salt,
      },
      makerAddress: ethers.utils.getAddress(args?.input.makerAddress),
      makeAsset: makeAssets,
      takerAddress: ethers.utils.getAddress(args?.input.takerAddress),
      takeAsset: takeAssets,
      chainId: wallet.chainId,
      createdInternally: true,
    })

    return {
      id: listingOrder.id,
      orderHash: listingOrder.orderHash,
      nonce: listingOrder.nonce,
      signature: listingOrder.protocolData.signature,
      makerAddress: listingOrder.makerAddress,
      makeAsset: listingOrder.makeAsset,
      start: listingOrder.activity.timestamp,
      end: listingOrder.activity.expiration,
      salt: listingOrder.protocolData.salt,
      chainId,
      auctionType: listingOrder.protocolData.auctionType,
    }
  } catch (err) {
    Sentry.captureMessage(`Error in createListing: ${err}`)
    return err
  }
}

// const validListingOrder = (
//   listing: entity.TxOrder,
// ): boolean => {
//   // if user wants to buy nft directly, its auction type should be fixed or decreasing method...
//   return (listing.protocolData.auctionType === defs.AuctionType.FixedPrice ||
//     listing.protocolData.auctionType === defs.AuctionType.Decreasing)
// }

/**
 * do validation on txHash and return block number if it's valid
 * @param txHash
 * @param chainId
 * @param marketAskId
 */
// const validateTxHashForBuyNow = async (
//   txHash: string,
//   chainId: string,
//   marketAskId: string,
// ): Promise<BuyNowInfo | undefined> => {
//   try {
//     const chainProvider = provider.provider(Number(chainId))
//     const repositories = db.newRepositories()
//     // check if tx hash has been executed...
//     const tx = await chainProvider.getTransaction(txHash)
//     if (!tx.confirmations)
//       return undefined
//
//     const sourceReceipt = await tx.wait()
//     const abi = contracts.marketplaceEventABI()
//     const iface = new ethers.utils.Interface(abi)
//     let eventEmitted = false
//     let buyNowTaker = null
//
//     const topics = [
//       ethers.utils.id('Match(bytes32,bytes32,uint8,(uint8,bytes32,bytes32),(uint8,bytes32,bytes32),bool)'),
//       ethers.utils.id('Match2A(bytes32,address,address,uint256,uint256,uint256,uint256)'),
//       ethers.utils.id('Match2B(bytes32,bytes[],bytes[],bytes4[],bytes[],bytes[],bytes4[])'),
//       ethers.utils.id('BuyNowInfo(bytes32,address)'),
//     ]
//     // look through events of tx and check it contains Match or Match2A or Match2B event...
//     // if it contains match events, then we validate if marketAskId is correct one...
//     await Promise.all(
//       sourceReceipt.logs.map(async (log) => {
//         if (topics.find((topic) => topic === log.topics[0])) {
//           const event = iface.parseLog(log)
//           if (event.name === 'Match') {
//             const makerHash = event.args.makerStructHash
//             const auctionType = event.args.auctionType == 0 ?
//               defs.AuctionType.FixedPrice :
//               event.args.auctionType == 1 ?
//                 defs.AuctionType.English :
//                 defs.AuctionType.Decreasing
//             if (auctionType === defs.AuctionType.English) eventEmitted = false
//             else {
//               const marketAsk = await repositories.marketAsk.findOne({
//                 where: {
//                   id: marketAskId,
//                   structHash: makerHash,
//                 },
//               })
//               eventEmitted = (marketAsk !== undefined)
//             }
//           }
//           if (event.name === 'Match2A') {
//             const makerHash = event.args.makerStructHash
//             const marketAsk = await repositories.marketAsk.findOne({
//               where: {
//                 id: marketAskId,
//                 structHash: makerHash,
//               },
//             })
//             eventEmitted = (marketAsk !== undefined)
//           }
//           if (event.name === 'Match2B') {
//             const makerHash = event.args.makerStructHash
//             const marketAsk = await repositories.marketAsk.findOne({
//               where: {
//                 id: marketAskId,
//                 structHash: makerHash,
//               },
//             })
//             eventEmitted = (marketAsk !== undefined)
//           }
//           if (event.name === 'BuyNowInfo') {
//             const makerHash = event.args.makerStructHash
//             buyNowTaker = event.args.args.takerAddress
//             const marketAsk = await repositories.marketAsk.findOne({
//               where: {
//                 id: marketAskId,
//                 structHash: makerHash,
//               },
//             })
//             eventEmitted = (marketAsk !== undefined)
//           }
//         }
//       }))
//     if (eventEmitted) {
//       return {
//         block: tx.blockNumber,
//         buyNowTaker: buyNowTaker,
//       } as BuyNowInfo
//     }
//     else return undefined
//   } catch (e) {
//     logger.debug(`${txHash} is not valid`, e)
//     Sentry.captureException(e)
//     Sentry.captureMessage(`Error in validateTxHashForBuyNow: ${e}`)
//     return undefined
//   }
// }

const buyNow = async (
  _: any,
  args: gql.MutationBuyNowArgs,
  ctx: Context,
): Promise<gql.MarketSwap> => {
  const { user } = ctx
  logger.debug('buyNow', { loggedInUserId: user?.id, input: args?.input })

  const schema = Joi.object().keys({
    marketAskId: Joi.string().required(),
    txHash: Joi.string().required(),
  })
  joi.validateSchema(schema, args?.input)
  return null
  // return repositories.marketAsk.findById(args?.input.marketAskId)
  //   .then(fp.rejectIfEmpty(appError.buildNotFound(
  //     marketAskError.buildMarketAskNotFoundMsg(args?.input.marketAskId),
  //     marketAskError.ErrorType.MarketAskNotFound,
  //   )))
  //   .then((ask: entity.MarketAsk): Promise<entity.MarketSwap> => {
  //     if (validMarketAsk(ask)) {
  //       if (!ask.marketSwapId) {
  //         return validateTxHashForBuyNow(args?.input.txHash, ask.chainId, args?.input.marketAskId)
  //           .then((buyNowInfo): Promise<entity.MarketSwap> => {
  //             if (buyNowInfo) {
  //               if (buyNowInfo.buyNowTaker) {
  //                 return repositories.marketSwap.findOne({
  //                   where: {
  //                     txHash: args?.input.txHash,
  //                     marketAsk: ask,
  //                   } as FindOptionsWhere<entity.MarketAsk>,
  //                 })
  //                   .then(fp.rejectIfNotEmpty(appError.buildExists(
  //                     marketSwapError.buildMarketSwapExistingMsg(),
  //                     marketSwapError.ErrorType.MarketSwapExisting,
  //                   )))
  //                   .then(() =>
  //                     repositories.marketSwap.save({
  //                       txHash: args?.input.txHash,
  //                       blockNumber: buyNowInfo.block.toFixed(),
  //                       marketAsk: ask,
  //                     }).then((swap: entity.MarketSwap) =>
  //                       blockNumberToTimestamp(Number(buyNowInfo.block.toFixed()), ask.chainId)
  //                         .then((time) => repositories.marketAsk.updateOneById(ask.id, {
  //                           marketSwapId: swap.id,
  //                           offerAcceptedAt: new Date(time),
  //                           buyNowTaker: buyNowInfo.buyNowTaker,
  //                         }).then(() => swap)),
  //                     ))
  //               } else {
  //                 return Promise.reject(appError.buildInvalid(
  //                   marketAskError.buildTxHashInvalidMsg(args?.input.txHash),
  //                   marketAskError.ErrorType.TxHashInvalid,
  //                 ))
  //               }
  //             }})
  //       } else {
  //         return Promise.reject(appError.buildInvalid(
  //           marketAskError.buildMarketAskBoughtMsg(),
  //           marketAskError.ErrorType.MarketAskBought))
  //       }
  //     } else {
  //       return Promise.reject(appError.buildInvalid(
  //         marketAskError.buildAuctionTypeInvalidMsg(),
  //         marketAskError.ErrorType.AuctionTypeInvalid,
  //       ))
  //     }
  //   })
}

const filterListings = (
  _: any,
  args: gql.QueryFilterListingsArgs,
  ctx: Context,
): Promise<gql.GetListingOrders> => {
  const { repositories } = ctx
  console.log(repositories)
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
  // const filters: Partial<entity.MarketAsk>[] = [
  //   helper.removeEmpty({
  //     auctionType,
  //     chainId,
  //   }),
  // ]
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
  console.log(auctionType, pageInput)
  console.log(orderKey, orderDirection)
  return null
  // return core.paginatedEntitiesBy(
  //   repositories.marketAsk,
  //   pageInput,
  //   filters,
  //   [],
  //   orderKey,
  //   orderDirection,
  // )
  //   .then(pagination.toPageable(pageInput))
}

// TODOs
// 1. add more advanced filters (sort by price, sort by floor)
// 2. filter asks from a single user (walletId or address)
// 3. filter private orders (designated takerAddress)
// 4. show all marketAsk / marketBid, even if NFT is not in wallet -> to allow user to cancel
//      -> front end to show if signature has enough balance
// 5. get singular ASK (show all bids for a single ask)

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
      !(listingTaker == helper.AddressZero() || listingTaker == '0x' ||
        helper.checkSum(listingTaker) == helper.checkSum(marketBidArgs?.input.makerAddress))
    ) {
      throw Error(`Bidder ${marketBidArgs?.input.makerAddress} not equal to Listing owner's Taker ${listingTaker}`)
    }

    // make sure assets match via contract
    const result = await validationLogicContract.validateMatch_(
      {
        maker: listing.makerAddress,
        makeAssets: getAssetList(listing.makeAsset),
        taker: listing.takerAddress,
        takeAssets: getAssetList(listing.takeAsset),
        salt: listing.protocolData.salt,
        start: askStart,
        end: askEnd,
        nonce: listing.nonce,
        auctionType: utils.auctionTypeToInt(listing.protocolData.auctionType),
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

const createBid = async (
  _: any,
  args: gql.MutationCreateMarketBidArgs,
  ctx: Context,
): Promise<gql.TxListingOrder> => {
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
      takeAsset: Joi.array().min(0).max(100).items(
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

    if (ethers.utils.getAddress(args?.input.makerAddress) !==
      ethers.utils.getAddress(wallet.address)) {
      return Promise.reject(appError.buildForbidden(
        marketBidError.buildMakerAddressNotOwnedMsg(),
        marketBidError.ErrorType.MakerAddressNotOwned,
      ))
    }

    const listing = await repositories.txOrder.findById(args?.input.listingId)
    if (!listing) {
      return Promise.reject(appError.buildForbidden(
        marketBidError.buildMarketListingNotFoundMsg(),
        marketBidError.ErrorType.MarketListingNotFound,
      ))
    }

    const isValid = await validOrderMatch(listing, args, wallet)
    if (!isValid) {
      return Promise.reject(appError.buildInvalid(
        marketBidError.buildMarketBidInvalidMsg(),
        marketBidError.ErrorType.MarketBidInvalid,
      ))
    }

    let bidOrder = await repositories.txOrder.findOne({
      where: {
        orderHash: args?.input.structHash,
      },
    })
    if (bidOrder) {
      return Promise.reject(appError.buildExists(
        marketBidError.buildMarketBidExistingMsg(),
        marketBidError.ErrorType.MarketBidExisting,
      ))
    }
    const activity = await activityBuilder(
      defs.ActivityType.Bid,
      args?.input.structHash,
      wallet.address,
      chainId,
      [],
      '0x',
      args?.input.start,
      args?.input.end,
    )
    bidOrder = await repositories.txOrder.save({
      activity,
      orderHash: args?.input.structHash,
      exchange: defs.ExchangeType.Marketplace,
      orderType: defs.ActivityType.Bid,
      protocol: defs.ProtocolType.Marketplace,
      nonce: args?.input.nonce,
      protocolData: {
        auctionType: args?.input.auctionType,
        signature: args?.input.signature,
        salt: args?.input.salt,
      },
      makerAddress: ethers.utils.getAddress(args?.input.makerAddress),
      makeAsset: makeAssets,
      takerAddress: ethers.utils.getAddress(args?.input.takerAddress),
      takeAsset: takeAssets,
      chainId: wallet.chainId,
      listingId: args?.input.listingId,
      memo: args?.input.message,
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
      makeAsset: bidOrder.makeAsset,
      start: bidOrder.activity.timestamp,
      end: bidOrder.activity.expiration,
      salt: bidOrder.protocolData.salt,
      chainId,
      auctionType: bidOrder.protocolData.auctionType,
    }
  } catch (err) {
    Sentry.captureMessage(`Error in createListing: ${err}`)
    return err
  }
}

const cancelBid = async (
  _: any,
  args: gql.MutationCancelMarketBidArgs,
  ctx: Context,
): Promise<boolean> => {
  const { user, repositories, wallet, chain } = ctx
  const chainId = chain.id || process.env.CHAIN_ID
  auth.verifyAndGetNetworkChain('ethereum', chainId)
  logger.debug('cancelBid', { loggedInUserId: user?.id, input: args?.input })
  try {
    const bidOrder = await repositories.txOrder.findById(args?.input.bidOrderId)
    if (!bidOrder) {
      return Promise.reject(appError.buildNotFound(
        marketBidError.buildMarketBidNotFoundMsg(args?.input.bidOrderId),
        marketBidError.ErrorType.MarketBidNotFound,
      ))
    }
    if (ethers.utils.getAddress(bidOrder.makerAddress) !== ethers.utils.getAddress(wallet.address)) {
      return Promise.reject(appError.buildForbidden(
        marketBidError.buildMarketBidNotOwnedMsg(),
        marketBidError.ErrorType.MarketBidNotOwned,
      ))
    }
    const isValid = await validateTxHashForCancel(
      args?.input.txHash,
      bidOrder.chainId,
      args?.input.bidOrderId,
      ListingOrBid.Bid,
    )
    if (!isValid) {
      return Promise.reject(appError.buildInvalid(
        marketBidError.buildTxHashInvalidMsg(args?.input.txHash),
        marketBidError.ErrorType.TxHashInvalid,
      ))
    }
    const txCancel = await repositories.txCancel.findOne({
      where: {
        exchange: defs.ExchangeType.Marketplace,
        foreignType: defs.CancelActivities[1],
        foreignKeyId: bidOrder.orderHash,
        transactionHash: args?.input.txHash,
        chainId,
      },
    })
    if (!txCancel) {
      const chainProvider = provider.provider(Number(chainId))
      const tx = await chainProvider.getTransaction(args?.input.txHash)
      await repositories.txCancel.save({
        activity: bidOrder.activity,
        exchange: defs.ExchangeType.Marketplace,
        foreignType: defs.CancelActivities[1],
        foreignKeyId: bidOrder.orderHash,
        transactionHash: args?.input.txHash,
        blockNumber: tx.blockNumber.toString(),
        chainId,
      })
      const bidActivity = await repositories.txActivity.findById(bidOrder.activity.id)
      await repositories.txActivity.updateOneById(bidActivity.id, { status: defs.ActivityStatus.Cancelled })
    }
    return true
  } catch (err) {
    Sentry.captureMessage(`Error in cancelListing: ${err}`)
    return err
  }
}

const getBids = (
  _: any,
  args: gql.QueryGetBidsArgs,
  ctx: Context,
): Promise<gql.GetListingOrders> => {
  const { repositories } = ctx
  logger.debug('getBids', { input: args?.input })
  const chainId = args?.input.chainId || process.env.CHAIN_ID
  auth.verifyAndGetNetworkChain('ethereum', chainId)
  const pageInput = args?.input?.pageInput
  const { makerAddress } = helper.safeObject(args?.input)

  const filter: Partial<entity.TxOrder> = helper.removeEmpty({
    makerAddress: ethers.utils.getAddress(makerAddress),
    exchange: defs.ExchangeType.Marketplace,
    orderType: defs.ActivityType.Bid,
    protocol: defs.ProtocolType.Marketplace,
    listingId: args?.input.listingOrderId,
    chainId,
  })
  return core.paginatedEntitiesBy(
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
    getNFTListings,
    filterListings,
    getBids,
  },
  Mutation: {
    createMarketListing: combineResolvers(auth.isAuthenticated, createListing),
    cancelMarketListing: combineResolvers(auth.isAuthenticated, cancelListing),
    buyNow: combineResolvers(auth.isAuthenticated, buyNow),
    createMarketBid: combineResolvers(auth.isAuthenticated, createBid),
    cancelMarketBid: combineResolvers(auth.isAuthenticated, cancelBid),

  },
}
