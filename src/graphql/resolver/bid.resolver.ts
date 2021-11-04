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

const logger = _logger.Factory(_logger.Context.GraphQL, _logger.Context.Bid)

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
    signature: buildSignatureInputSchema(),
    wallet: buildWalletInputSchema(),
  })
  validateSchema(schema, args)

  const { nftType, wallet, profileURL, price, signature } = args.input
  if (nftType === gql.NFTType.Profile && isEmpty(profileURL)) {
    throw appError.buildInvalidSchema(new Error('profileURL is required'))
  }

  return coreService.getWallet(ctx, wallet)
    .then(({ id: walletId }) => {
      if (nftType !== gql.NFTType.Profile) {
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
    wallet: coreService.resolveEntityById(
      'walletId',
      misc.EntityType.Approval,
      misc.EntityType.Wallet,
    ),
  },
}
