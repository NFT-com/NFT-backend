import { combineResolvers } from 'graphql-resolvers'
import Joi from 'joi'

import { Context, gql } from '@nftcom/gql/defs'
import { _logger, entity, fp, helper, provider } from '@nftcom/shared'

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

const swapNFT = (
  _: any,
  args: gql.MutationSwapNFTArgs,
  ctx: Context,
): Promise<gql.MarketSwap | void> => {
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
    .then((ask: entity.MarketAsk) =>
      repositories.marketBid.findById(args?.input.marketBidId)
        .then(fp.rejectIfEmpty(appError.buildNotFound(
          marketBidError.buildMarketBidNotFoundMsg(args?.input.marketBidId),
          marketBidError.ErrorType.MarketAskNotFound,
        )))
        .then((bid: entity.MarketBid) => {
          const chain = provider.provider(ask.chainId)
          chain.getTransaction(args?.input.txHash)
            .then((response) =>
              repositories.marketSwap.findOne({ where: { askId: ask.id, bidId: bid.id } })
                .then(fp.rejectIfNotEmpty(appError.buildInvalid(
                  marketSwapError.buildMarketSwapInvalidMsg(),
                  marketSwapError.ErrorType.MarketSwapInvalid,
                )))
                .then(() => repositories.marketSwap.save({
                  txHash: args?.input.txHash,
                  blockNumber: response.blockNumber.toFixed(),
                  marketAsk: ask,
                  marketBid: bid,
                })),
            )
            .catch((err) => {
              throw Error(`txHash ${args?.input.txHash} is not valid ${err} `)
            })
        }),
    )
}

export default {
  Query: {
    getSwaps: getSwaps,
  },
  Mutation: {
    swapNFT: combineResolvers(auth.isAuthenticated, swapNFT),
  },
}
