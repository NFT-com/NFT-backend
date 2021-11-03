import { combineResolvers } from 'graphql-resolvers'
import Joi from 'joi'
import { isEmpty } from 'lodash'

import { Context, entity } from '@src/db'
import { EntityType, gqlTypes } from '@src/defs'
import { appError } from '@src/graphql/error'
import { fp, helper } from '@src/helper'
import { LoggerContext, LoggerFactory } from '@src/helper/logger'

import { isAuthenticated } from './auth'
import { buildSignatureInputSchema, buildWalletInputSchema } from './joi'
import * as service from './service'

const logger = LoggerFactory(LoggerContext.GraphQL, LoggerContext.Bid)

const bid = (
  _: any,
  args: gqlTypes.MutationBidArgs,
  ctx: Context,
): Promise<gqlTypes.Bid> => {
  const { user, repositories } = ctx
  logger.debug('bid', { loggedInUserId: user.id, input: args.input })

  const schema = Joi.object().keys({
    price: Joi.number().required().greater(0),
    profileURL: Joi.string(),
    signature: buildSignatureInputSchema(),
    wallet: buildWalletInputSchema(),
  })
  const { error } = schema.validate(args.input, { abortEarly: false })
  if (error) {
    throw appError.buildInvalidSchemaError(error)
  }

  const { nftType, wallet, profileURL, price, signature } = args.input
  if (nftType === gqlTypes.NFTType.Profile && isEmpty(profileURL)) {
    throw appError.buildInvalidSchemaError(error)
  }

  return service.getWallet(ctx, wallet)
    .then(({ id: walletId }) => {
      if (nftType !== gqlTypes.NFTType.Profile) {
        return { walletId, profileId: null }
      }
      // TODO what about staked weighted seconds
      const createProfile = (): Promise<entity.Profile> => repositories.profile.save({
        creatorUserId: user.id,
        creatorWalletId: walletId,
        ownerUserId: user.id,
        ownerWalletId: walletId,
        url: profileURL,
      })
      // create profile if it doesn't exist
      return repositories.profile.findByURL(profileURL)
        .then(fp.thruIfEmpty(createProfile))
        .then(({ id }) => ({ walletId, profileId: id }))
    })
    .then(({ profileId, walletId }) => repositories.bid.save({
      nftType,
      price,
      profileId,
      signature,
      status: gqlTypes.BidStatus.Submitted,
      userId: user.id,
      walletId,
    }))
}

const getBidsBy = (ctx: Context, filter: Partial<entity.Bid>): Promise<gqlTypes.BidsOutput> => {
  return service.entitiesBy(ctx.repositories.bid, filter)
    .then((bids) => ({
      bids,
      pageInfo: null,
    }))
}

// TODO implement pagination
const getBids = (
  _: any,
  args: gqlTypes.QueryMyBidsArgs,
  ctx: Context,
): Promise<gqlTypes.BidsOutput> => {
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
  args: gqlTypes.QueryMyBidsArgs,
  ctx: Context,
): Promise<gqlTypes.BidsOutput> => {
  const { user } = ctx
  logger.debug('getMyBids', { loggedInUserId: user.id, input: args.input })
  return getBidsBy(ctx,  { userId: user.id })
}

export default {
  Query: {
    bids: combineResolvers(isAuthenticated, getBids),
    myBids: combineResolvers(isAuthenticated, getMyBids),
  },
  Mutation: {
    bid: combineResolvers(isAuthenticated, bid),
  },
  Bid: {
    wallet: service.resolveEntityById('walletId', EntityType.Bid, EntityType.Wallet),
  },
}
