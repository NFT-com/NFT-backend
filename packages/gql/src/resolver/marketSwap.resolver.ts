import { ethers } from 'ethers'
import { combineResolvers } from 'graphql-resolvers'
import Joi from 'joi'

import { Context, gql } from '@nftcom/gql/defs'
import { _logger, contracts, db, defs, entity, fp, helper, provider } from '@nftcom/shared'

import { appError, marketAskError, marketBidError, marketSwapError } from '../error'
import { auth, joi, pagination } from '../helper'
import { core } from '../service'

const logger = _logger.Factory(_logger.Context.MarketSwap, _logger.Context.GraphQL)

const getSwaps = (
  _: any,
  args: gql.QueryGetSwapsArgs,
  ctx: Context,
): Promise<gql.GetMarketSwap> => {
  const { repositories } = ctx
  logger.debug('getSwaps', { input: args?.input })
  const pageInput = args?.input?.pageInput
  const { marketAskId } = helper.safeObject(args?.input)

  const filter: Partial<entity.MarketSwap> = helper.removeEmpty({
    askId: marketAskId,
  })
  return core.paginatedEntitiesBy(
    repositories.marketSwap,
    pageInput,
    filter,
  )
    .then(pagination.toPageable(pageInput))
}

/**
 * do validation on txHash and return block number if it's valid
 * @param txHash
 * @param chainId
 * @param marketAskId
 * @param marketBidId
 */
const validateTxHashForSwapNFT = async (
  txHash: string,
  chainId: string,
  marketAskId: string,
  marketBidId: string,
): Promise<number | undefined> => {
  try {
    const repositories = db.newRepositories()
    const chainProvider = provider.provider(Number(chainId))
    // check if tx hash has been executed...
    const tx = await chainProvider.getTransaction(txHash)
    if (!tx.confirmations)
      return undefined

    const sourceReceipt = await tx.wait()
    const abi = contracts.marketplaceABIJSON()
    const iface = new ethers.utils.Interface(abi)
    let eventEmitted = false

    const topic = ethers.utils.id('Match(bytes32,bytes32,uint8,(uint8,bytes32,bytes32),(uint8,bytes32,bytes32),bool)')

    // look through events of tx and check it contains Match event...
    // if it contains Match event, then we validate if both marketAskId, marketBidId are correct ones...
    await Promise.all(
      sourceReceipt.logs.map(async (log) => {
        if (log.topics[0] === topic) {
          const event = iface.parseLog(log)
          if (event.name === 'Match') {
            const makerHash = event.args.makerStructHash
            const takerHash = event.args.takerStructHash
            const auctionType = event.args.auctionType == 0 ?
              defs.AuctionType.FixedPrice :
              event.args.auctionType == 1 ?
                defs.AuctionType.English :
                defs.AuctionType.Decreasing
            if (auctionType !== defs.AuctionType.English) eventEmitted = false
            else {
              let marketAsk
              let marketBid
              marketAsk = await repositories.marketAsk.findOne({
                where: {
                  id: marketAskId,
                  structHash: makerHash,
                },
              })
              if (!marketAsk) {
                // if maker is user who bid on ask...
                marketAsk = await repositories.marketAsk.findOne({
                  where: {
                    id: marketAskId,
                    structHash: takerHash,
                  },
                })
                marketBid = await repositories.marketBid.findOne({
                  where: {
                    id: marketBidId,
                    structHash: makerHash,
                  },
                })
              }
              else {
                // if maker is user who provided ask...
                marketBid = await repositories.marketBid.findOne({
                  where: {
                    id: marketBidId,
                    structHash: takerHash,
                  },
                })
              }
              if (!marketAsk || !marketBid) eventEmitted = false
              else {
                eventEmitted = (marketAsk.chainId === marketBid.chainId)
              }
            }
          }
        }
      }))
    if (eventEmitted) return tx.blockNumber
    else return undefined
  } catch (e) {
    logger.debug(`${txHash} is not valid`, e)
    return undefined
  }
}

const swapNFT = (
  _: any,
  args: gql.MutationSwapNFTArgs,
  ctx: Context,
): Promise<gql.MarketSwap> => {
  const { user, repositories } = ctx
  logger.debug('swapNFT', { loggedInUserId: user?.id, input: args?.input })

  const schema = Joi.object().keys({
    marketAskId: Joi.string().required(),
    marketBidId: Joi.string().required(),
    txHash: Joi.string().required(),
  })
  joi.validateSchema(schema, args?.input)
  return repositories.marketAsk.findById(args?.input.marketAskId)
    .then(fp.rejectIfEmpty(appError.buildNotFound(
      marketAskError.buildMarketAskNotFoundMsg(args?.input.marketAskId),
      marketAskError.ErrorType.MarketAskNotFound,
    )))
    .then((ask: entity.MarketAsk): Promise<entity.MarketSwap> => {
      return repositories.marketBid.findById(args?.input.marketBidId)
        .then(fp.rejectIfEmpty(appError.buildNotFound(
          marketBidError.buildMarketBidNotFoundMsg(args?.input.marketBidId),
          marketBidError.ErrorType.MarketAskNotFound,
        )))
        .then((bid: entity.MarketBid): Promise<entity.MarketSwap> => {
          return validateTxHashForSwapNFT(
            args?.input.txHash,
            ask.chainId,
            args?.input.marketAskId,
            args?.input.marketBidId,
          ).then((blockNumber): Promise<entity.MarketSwap> => {
            if (blockNumber) {
              return repositories.marketSwap.findOne({ where: { marketAsk: ask, marketBid: bid } })
                .then(fp.rejectIfNotEmpty(appError.buildExists(
                  marketSwapError.buildMarketSwapExistingMsg(),
                  marketSwapError.ErrorType.MarketSwapExisting,
                )))
                .then(() => repositories.marketSwap.save({
                  txHash: args?.input.txHash,
                  blockNumber: blockNumber.toFixed(),
                  marketAsk: ask,
                  marketBid: bid,
                }))
            } else {
              return Promise.reject(appError.buildInvalid(
                marketSwapError.buildTxHashInvalidMsg(args?.input.txHash),
                marketSwapError.ErrorType.TxHashInvalid,
              ))
            }
          })
        })
    })
}

export default {
  Query: {
    getSwaps: getSwaps,
  },
  Mutation: {
    swapNFT: combineResolvers(auth.isAuthenticated, swapNFT),
  },
}
