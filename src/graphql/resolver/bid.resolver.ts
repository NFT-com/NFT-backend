import { combineResolvers } from 'graphql-resolvers'
import Joi from 'joi'
import { isEmpty } from 'lodash'

import { Context, entity } from '@src/db'
import { gql, misc } from '@src/defs'
import { appError } from '@src/graphql/error'
import { _logger, fp, helper } from '@src/helper'

import { isAuthenticated } from './auth'
import * as coreService from './core.service'
import { buildSignatureInputSchema, buildWalletInputSchema, validateSchema } from './joi'

const logger = _logger.Factory(_logger.Context.Bid, _logger.Context.GraphQL)

const bid = (
  _: any,
  args: gql.MutationBidArgs,
  ctx: Context,
): Promise<gql.Bid> => {
  const { user, repositories } = ctx
  logger.debug('bid', { loggedInUserId: user.id, input: args.input })

  const schema = Joi.object().keys({
    price: Joi.number().required().greater(0),
    profileURL: Joi.string(),
    profileBannerURL: Joi.string(),
    signature: buildSignatureInputSchema(),
    wallet: buildWalletInputSchema(),
  })
  validateSchema(schema, args)

  const { input } = args
  if (input.nftType === gql.NFTType.Profile && isEmpty(input.profileURL)) {
    throw appError.buildInvalidSchema(new Error('profileURL is required'))
  }

  return coreService.getWallet(ctx, input.wallet)
    .then(({ id: walletId }) => {
      if (input.nftType !== gql.NFTType.Profile) {
        return { walletId, profileId: null }
      }
      // TODO what about staked weighted seconds
      const createProfile = (): Promise<entity.Profile> =>
        repositories.profile.save({
          url: input.profileURL,
          bannerURL: input.profileBannerURL,
        })
      // create profile if it doesn't exist
      return repositories.profile.findByURL(input.profileURL)
        .then(fp.thruIfEmpty(createProfile))
        .then(({ id }) => ({ walletId, profileId: id }))
    })
    .then(({ profileId, walletId }) => repositories.bid.save({
      nftType: input.nftType,
      price: input.price,
      profileId,
      signature: input.signature,
      status: gql.BidStatus.Submitted,
      userId: user.id,
      walletId,
    }))
}

const getBidsBy = (ctx: Context, filter: Partial<entity.Bid>): Promise<gql.BidsOutput> => {
  return coreService.entitiesBy(ctx.repositories.bid, filter)
    .then((bids) => ({
      bids,
      pageInfo: null,
    }))
}

// TODO implement pagination
const getBids = (
  _: any,
  args: gql.QueryMyBidsArgs,
  ctx: Context,
): Promise<gql.BidsOutput> => {
  const { user } = ctx
  logger.debug('getBids', { loggedInUserId: user.id, input: args.input })

  const { profileId } = args.input
  let filter = {}
  if (helper.isNotEmpty(profileId)) {
    filter = Object.assign({}, filter, { profileId })
  }

  return getBidsBy(ctx, filter)
}

// TODO implement pagination
const getMyBids = (
  _: any,
  args: gql.QueryMyBidsArgs,
  ctx: Context,
): Promise<gql.BidsOutput> => {
  const { user } = ctx
  logger.debug('getMyBids', { loggedInUserId: user.id, input: args.input })
  return getBidsBy(ctx, { userId: user.id })
}

export default {
  Query: {
    bids: getBids,
    myBids: combineResolvers(isAuthenticated, getMyBids),
  },
  Mutation: {
    bid: combineResolvers(isAuthenticated, bid),
  },
  Bid: {
    wallet: coreService.resolveEntityById(
      'walletId',
      misc.EntityType.Approval,
      misc.EntityType.Wallet,
    ),
  },
}
