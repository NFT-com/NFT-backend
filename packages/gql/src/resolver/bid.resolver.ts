import { differenceInSeconds, isEqual } from 'date-fns'
import { combineResolvers } from 'graphql-resolvers'
import Joi from 'joi'
import { isEmpty } from 'lodash'

import { Context, gql, Pageable } from '@nftcom/gql/defs'
import { appError } from '@nftcom/gql/error'
import { auth, joi, pagination } from '@nftcom/gql/helper'
import { core, sendgrid } from '@nftcom/gql/service'
import { _logger, defs, entity, fp, helper } from '@nftcom/shared'

import { Maybe } from '../defs/gql'

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
    price: Joi.required().custom(joi.buildBigNumber),
    profileURL: Joi.string(),
    signature: joi.buildSignatureInputSchema(),
    wallet: joi.buildWalletInputSchema(),
  })
  const { input } = args
  joi.validateSchema(schema, input)

  if (input.nftType === gql.NFTType.Profile && isEmpty(input.profileURL)) {
    throw appError.buildInvalidSchema(new Error('profileURL is required'))
  }

  return core.getWallet(ctx, input.wallet)
    .then(({ id: walletId }) => {
      if (input.nftType !== gql.NFTType.Profile) {
        return { walletId, profileId: null }
      }

      // create profile if it doesn't exist
      return repositories.profile.findByURL(input.profileURL)
        .then(fp.thruIfEmpty(() => core.createProfile(ctx, { url: input.profileURL })))
        .then(({ id }) => ({ walletId, profileId: id }))
    })
    .then(({ profileId, walletId }) => {
      if (input.nftType !== gql.NFTType.Profile) {
        // TODO: find bid and prevTopBid for non-profile NFTs too.
        return { walletId, profileId, stakeWeight: null, bid: null, prevTopBid: null }
      }

      // calculate stake weight seconds
      return repositories.bid.findRecentBidByProfileUser(profileId, user.id)
        .then((bid) => {
          const now = helper.toUTCDate()
          const existingUpdateTime = bid?.updatedAt || now
          const existingStake = bid?.price || 0
          const existingStakeWeight = bid?.stakeWeightedSeconds || 0
          const curSeconds = isEqual(now, existingUpdateTime)
            ? 0
            : differenceInSeconds(now, existingUpdateTime)
          const bigNumStake = helper.bigNumber(existingStake).div(helper.tokenDecimals)
          const stakeWeight = existingStakeWeight + curSeconds * Number(bigNumStake)
          return {
            walletId,
            profileId,
            stakeWeight,
            bid,
            prevTopBid: repositories.bid.findTopBidByProfile(profileId),
          }
        })
    })
    .then(({ profileId, walletId, stakeWeight, bid, prevTopBid }) => {
      return Promise.all([
        repositories.bid.save({
          id: bid?.id,
          nftType: input.nftType,
          price: helper.bigNumberToString(input.price),
          profileId,
          signature: input.signature,
          stakeWeightedSeconds: stakeWeight,
          status: gql.BidStatus.Submitted,
          userId: user.id,
          walletId,
        }),
        prevTopBid,
      ])
    })
    .then(fp.tapIf(() => user.preferences.bidActivityNotifications)(( [newBid] ) =>
      sendgrid.sendBidConfirmEmail(newBid, user, input.profileURL)))
    .then(fp.tapIf(([, prevTopBid]) => prevTopBid != null)(
      ([, prevTopBid]) =>
        repositories.user.findById(prevTopBid.userId)
          .then(fp.thruIf(
            (prevTopBidOwner: Maybe<entity.User>) =>
              prevTopBidOwner?.preferences?.outbidNotifications)(
            (prevTopBidOwner) =>
              sendgrid.sendOutbidEmail(prevTopBid, prevTopBidOwner, input.profileURL))),
    ))
    .then(([newBid]) => newBid)
}

// TODO pagination is broken
const getBidsBy = (
  ctx: Context,
  filter: Partial<entity.Bid>,
  pageInput: gql.PageInput,
): Promise<Pageable<entity.Bid>> => {
  return core.paginatedEntitiesBy(
    ctx.repositories.bid,
    filter,
    { createdAt: 'DESC' },
    {
      skip: 0,
      take: 20,
    },
  )
    .then(pagination.toPageable(pageInput))
}

const getBids = (
  _: any,
  args: gql.QueryMyBidsArgs,
  ctx: Context,
): Promise<Pageable<entity.Bid>> => {
  const { user } = ctx
  logger.debug('getBids', { loggedInUserId: user?.id, input: args?.input })
  const pageInput = pagination.safeInput(args?.input?.pageInput)
  const filter = helper.inputT2SafeK(args?.input)
  return getBidsBy(ctx, filter, pageInput)
}

const getMyBids = (
  _: any,
  args: gql.QueryMyBidsArgs,
  ctx: Context,
): Promise<Pageable<entity.Bid>> => {
  const { user } = ctx
  logger.debug('getMyBids', { loggedInUserId: user.id, input: args?.input })
  const pageInput = pagination.safeInput(args?.input?.pageInput)
  const filter = helper.inputT2SafeK<entity.Bid>(args?.input, { userId: user.id })
  return getBidsBy(ctx, filter, pageInput)
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

// TODO pagination is broken
const getTopBids = (
  _: any,
  args: gql.QueryTopBidsArgs,
  ctx: Context,
): Promise<Pageable<entity.Bid>> => {
  const { user, repositories } = ctx
  logger.debug('getTopBids', { loggedInUserId: user?.id, input: args?.input })
  const pageInput = pagination.safeInput(args?.input?.pageInput)
  const filter = helper.inputT2SafeK(args?.input)
  return repositories.bid.findTopBidsBy(filter, 0, 20)
    .then(pagination.toPageable(pageInput))
}

export default {
  Query: {
    bids: getBids,
    myBids: combineResolvers(auth.isAuthenticated, getMyBids),
    topBids: getTopBids,
  },
  Mutation: {
    bid: combineResolvers(auth.isAuthenticated, bid),
    cancelBid: combineResolvers(auth.isAuthenticated, cancelBid),
  },
  Bid: {
    profile: core.resolveEntityById<gql.Bid, entity.Profile>(
      'profileId',
      defs.EntityType.Bid,
      defs.EntityType.Profile,
    ),
    wallet: core.resolveEntityById<gql.Bid, entity.Wallet>(
      'walletId',
      defs.EntityType.Bid,
      defs.EntityType.Wallet,
    ),
  },
}
