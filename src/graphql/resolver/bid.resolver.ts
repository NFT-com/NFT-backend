import { differenceInSeconds, isEqual } from 'date-fns'
import { combineResolvers } from 'graphql-resolvers'
import Joi from 'joi'
import { isEmpty } from 'lodash'

import { Context, entity } from '@src/db'
import { gql, misc } from '@src/defs'
import { appError } from '@src/graphql/error'
import { _logger, fp, helper } from '@src/helper'

import { isAuthenticated } from './auth'
import * as coreService from './core.service'
import {
  buildBigNumber,
  buildSignatureInputSchema,
  buildWalletInputSchema,
  validateSchema,
} from './joi'

const logger = _logger.Factory(_logger.Context.Bid, _logger.Context.GraphQL)

const bid = (
  _: any,
  args: gql.MutationBidArgs,
  ctx: Context,
): Promise<gql.Bid> => {
  const { user, repositories } = ctx
  logger.debug('bid', { loggedInUserId: user.id, input: args.input })

  const schema = Joi.object().keys({
    nftType: Joi.string().required().valid(...Object.values(gql.NFTType)),
    price: Joi.required().custom(buildBigNumber),
    profileURL: Joi.string(),
    signature: buildSignatureInputSchema(),
    wallet: buildWalletInputSchema(),
  })
  const { input } = args
  validateSchema(schema, input)

  if (input.nftType === gql.NFTType.Profile && isEmpty(input.profileURL)) {
    throw appError.buildInvalidSchema(new Error('profileURL is required'))
  }

  return coreService.getWallet(ctx, input.wallet)
    .then(({ id: walletId }) => {
      if (input.nftType !== gql.NFTType.Profile) {
        return { walletId, profileId: null }
      }

      // create profile if it doesn't exist
      return repositories.profile.findByURL(input.profileURL)
        .then(fp.thruIfEmpty(() => coreService.createProfile(ctx, { url: input.profileURL })))
        .then(({ id }) => ({ walletId, profileId: id }))
    })
    .then(({ profileId, walletId }) => {
      if (input.nftType !== gql.NFTType.Profile) {
        return { walletId, profileId, stakeWeight: null }
      }

      // calculate stake weight seconds
      return repositories.bid.findRecentBidByProfileUser(profileId, user.id)
        .then((bid) => {
          const now = helper.getUTCDate()
          const existingUpdateTime = bid?.updatedAt || now
          const existingStake = bid?.price || 0
          const existingStakeWeight = bid?.stakeWeightedSeconds || 0
          const curSeconds = isEqual(now, existingUpdateTime)
            ? 0
            : differenceInSeconds(now, existingUpdateTime)
          const bigNumStake = helper.bigNumber(existingStake).div(helper.tokenDecimals)
          const stakeWeight = existingStakeWeight + curSeconds * Number(bigNumStake)
          return { walletId, profileId, stakeWeight }
        })
    })
    .then(({ profileId, walletId, stakeWeight }) => {
      return repositories.bid.save({
        nftType: input.nftType,
        price: helper.bigNumberToString(input.price),
        profileId,
        signature: input.signature,
        stakeWeightedSeconds: stakeWeight,
        status: gql.BidStatus.Submitted,
        userId: user.id,
        walletId,
      })
    })
}

const getBidsBy = (ctx: Context, filter: Partial<entity.Bid>): Promise<gql.BidsOutput> => {
  return coreService.entitiesBy(ctx.repositories.bid, filter, { createdAt: 'DESC' })
    .then((bids) => ({
      bids,
      pageInfo: null,
    }))
}

const toBidFilter = (input: gql.BidsInput): Partial<entity.Bid> => {
  const { profileId, walletId } = helper.safeObject(input)
  return helper.removeEmpty({
    profileId,
    walletId,
  })
}

// TODO implement pagination
const getBids = (
  _: any,
  args: gql.QueryMyBidsArgs,
  ctx: Context,
): Promise<gql.BidsOutput> => {
  const { user } = ctx
  logger.debug('getBids', { loggedInUserId: user?.id, input: args?.input })
  return getBidsBy(ctx, toBidFilter(args?.input))
}

// TODO implement pagination
const getMyBids = (
  _: any,
  args: gql.QueryMyBidsArgs,
  ctx: Context,
): Promise<gql.BidsOutput> => {
  const { user } = ctx
  logger.debug('getMyBids', { loggedInUserId: user.id, input: args?.input })
  return getBidsBy(ctx, toBidFilter(args?.input))
}

const cancelBid = (
  _: any,
  args: gql.MutationCancelBidArgs,
  ctx: Context,
): Promise<boolean> => {
  const { user, repositories } = ctx
  logger.debug('cancelBid', { loggedInUserId: user.id, input: args })
  return repositories.bid.deleteById(args.id)
}

const getTopBids = (
  _: any,
  args: gql.QueryTopBidsArgs,
  ctx: Context,
): Promise<gql.BidsOutput> => {
  const { user, repositories } = ctx
  logger.debug('getTopBids', { loggedInUserId: user?.id, input: args?.input })
  const { profileId } = helper.safeObject(args?.input)
  const filter = helper.removeEmpty({
    profileId,
  })
  return repositories.bid.findTopBidsBy(filter)
    .then((bids) => ({
      bids,
      pageInfo: null,
    }))
}

export default {
  Query: {
    bids: getBids,
    myBids: combineResolvers(isAuthenticated, getMyBids),
    topBids: getTopBids,
  },
  Mutation: {
    bid: combineResolvers(isAuthenticated, bid),
    cancelBid: combineResolvers(isAuthenticated, cancelBid),
  },
  Bid: {
    profile: coreService.resolveEntityById(
      'profileId',
      misc.EntityType.Bid,
      misc.EntityType.Profile,
    ),
    wallet: coreService.resolveEntityById(
      'walletId',
      misc.EntityType.Bid,
      misc.EntityType.Wallet,
    ),
  },
}
