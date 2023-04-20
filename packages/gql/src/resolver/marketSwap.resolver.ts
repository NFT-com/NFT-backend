import { ethers } from 'ethers'
import { combineResolvers } from 'graphql-resolvers'
import Joi from 'joi'

import { auth, Context, joi } from '@nftcom/misc'
import { _logger, contracts, db, defs, entity, helper, provider } from '@nftcom/shared'
import * as Sentry from '@sentry/node'

import { gql } from '../defs'

const logger = _logger.Factory(_logger.Context.MarketSwap, _logger.Context.GraphQL)

const getSwaps = (_: any, args: gql.QueryGetSwapsArgs, ctx: Context): Promise<gql.GetMarketSwap> => {
  const { repositories } = ctx
  logger.debug('getSwaps', { input: args?.input })
  const pageInput = args?.input?.pageInput
  const { marketAskIds, marketBidIds } = helper.safeObject(args?.input)

  logger.log(repositories, pageInput)
  const filters: Partial<entity.MarketSwap>[] = [
    ...(marketAskIds ?? []).map(askIdToFind =>
      helper.removeEmpty({
        marketAsk:
          askIdToFind == null
            ? null
            : {
                id: askIdToFind,
              },
      }),
    ),
    ...(marketBidIds ?? []).map(bidIdToFind =>
      helper.removeEmpty({
        marketBid:
          bidIdToFind == null
            ? null
            : {
                id: bidIdToFind,
              },
      }),
    ),
  ]
  logger.log(filters)
  return null
}

const getUserSwaps = (_: any, args: gql.QueryGetUserSwapsArgs, ctx: Context): Promise<gql.GetMarketSwap> => {
  const { repositories } = ctx
  logger.debug('getUserSwaps', { input: args?.input })
  const pageInput = args?.input?.pageInput
  const { participant } = helper.safeObject(args?.input)
  // TODO: also find the swaps where input.participant initiated a "buyNow" event
  // in that case, there is just one MarketAsk and the buyer's address isn't saved
  // anywhere in our DB currently.
  logger.debug(repositories, pageInput)
  const filters: Partial<entity.MarketSwap>[] = [
    helper.removeEmpty({
      marketAsk: {
        makerAddress: participant,
      },
    }),
    helper.removeEmpty({
      marketAsk: {
        takerAddress: participant,
      },
    }),
    helper.removeEmpty({
      marketBid: {
        makerAddress: participant,
      },
    }),
    helper.removeEmpty({
      marketBid: {
        takerAddress: participant,
      },
    }),
  ]
  logger.debug(filters)
  return null
}

/**
 * do validation on txHash and return block number if it's valid
 * @param txHash
 * @param chainId
 * @param marketAskId
 * @param marketBidId
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    if (!tx.confirmations) return undefined

    const sourceReceipt = await tx.wait()
    const abi = contracts.marketplaceABIJSON()
    const iface = new ethers.utils.Interface(abi)
    let eventEmitted = false

    const topic = ethers.utils.id('Match(bytes32,bytes32,uint8,(uint8,bytes32,bytes32),(uint8,bytes32,bytes32),bool)')

    // look through events of tx and check it contains Match event...
    // if it contains Match event, then we validate if both marketAskId, marketBidId are correct ones...
    await Promise.all(
      sourceReceipt.logs.map(async log => {
        if (log.topics[0] === topic) {
          const event = iface.parseLog(log)
          if (event.name === 'Match') {
            const makerHash = event.args.makerStructHash
            const takerHash = event.args.takerStructHash
            const auctionType =
              event.args.auctionType == 0
                ? defs.AuctionType.FixedPrice
                : event.args.auctionType == 1
                ? defs.AuctionType.English
                : defs.AuctionType.Decreasing
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
              } else {
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
                eventEmitted = marketAsk.chainId === marketBid.chainId
              }
            }
          }
        }
      }),
    )
    if (eventEmitted) return tx.blockNumber
    else return undefined
  } catch (e) {
    logger.debug(`${txHash} is not valid`, e)
    Sentry.captureException(e)
    Sentry.captureMessage(`Error in validateTxHashForSwapNFT: ${e}`)
    return undefined
  }
}

const swapNFT = (_: any, args: gql.MutationSwapNFTArgs, ctx: Context): Promise<gql.MarketSwap> => {
  const { user } = ctx
  logger.debug('swapNFT', { loggedInUserId: user?.id, input: args?.input })

  const schema = Joi.object().keys({
    marketAskId: Joi.string().required(),
    marketBidId: Joi.string().required(),
    txHash: Joi.string().required(),
  })
  joi.validateSchema(schema, args?.input)
  return null
}

export default {
  Query: {
    getSwaps,
    getUserSwaps,
  },
  Mutation: {
    swapNFT: combineResolvers(auth.isAuthenticated, swapNFT),
  },
}
