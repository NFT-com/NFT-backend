import cryptoRandomString from 'crypto-random-string'
import { addDays } from 'date-fns'
import { combineResolvers } from 'graphql-resolvers'
import Joi from 'joi'
import { isEmpty } from 'lodash'

import { Context, entity } from '@src/db'
import { gql, misc } from '@src/defs'
import { appError, userError, walletError } from '@src/graphql/error'
import { _logger, fp } from '@src/helper'
import { sendgrid } from '@src/service'

import { isAuthenticated, verifyAndGetNetworkChain } from './auth'
import * as coreService from './core.service'
import { buildWalletInputSchema, validateSchema } from './joi'

const logger = _logger.Factory(_logger.Context.User, _logger.Context.GraphQL)

// type UserOut = gql.User & entity.User

const signUp = (
  _: any,
  args: gql.MutationSignUpArgs,
  ctx: Context,
): Promise<gql.User> => {
  const { repositories } = ctx
  logger.debug('signUp', { input: args.input })

  const schema = Joi.object().keys({
    avatarURL: Joi.string(),
    email: Joi.string().required(),
    referredBy: Joi.string(),
    wallet: buildWalletInputSchema(),
  })
  validateSchema(schema, args.input)

  const { email, avatarURL, referredBy = '', wallet } = args.input
  const { address, network, chainId } = wallet
  const chain = verifyAndGetNetworkChain(network, chainId)

  return Promise.all([
      repositories.user.exists({ email }),
      repositories.wallet.exists({ network, chainId, address }),
    ])
    .then(([userExists, addressExists]) => {
      if (userExists) {
        return Promise.reject(appError.buildExists(
          userError.buildEmailExistsMsg(email),
          userError.ErrorType.EmailAlreadyExists,
        ))
      }
      if (addressExists) {
        return Promise.reject(appError.buildExists(
          walletError.buildAddressExistsMsg(network, chain, address),
          walletError.ErrorType.AddressAlreadyExists,
        ))
      }
      return referredBy
    })
    .then(fp.thruIfNotEmpty((refId) => repositories.user
      .findByReferralId(refId).then((user) => user?.id),
    ))
    .then(async (referredUserId) => {
      const confirmEmailToken = cryptoRandomString({ length: 10, type: 'url-safe' })
      const confirmEmailTokenExpiresAt = addDays(new Date(), 1)
      const referralId = cryptoRandomString({ length: 10, type: 'url-safe' })
      return repositories.user.save({
        email,
        referredBy: referredUserId || null,
        avatarURL,
        confirmEmailToken,
        confirmEmailTokenExpiresAt,
        referralId,
      })
    })
    .then(fp.tapWait<entity.User, unknown>((user) => Promise.all([
      repositories.wallet.save({
        userId: user.id,
        network,
        chainId: chain.id,
        chainName: chain.name,
        address,
      }),
      sendgrid.sendConfirmEmail(user),
    ])))
}

const confirmEmail = (
  _: any,
  args: gql.MutationConfirmEmailArgs,
  ctx: Context,
): Promise<boolean> => {
  logger.debug('confirmEmail', { input: args })
  const { repositories } = ctx

  const schema = Joi.object().keys({
    token: Joi.string().required(),
  })
  validateSchema(schema, args)

  const { token } = args
  const invalidTokenError = appError.buildInvalid(
    userError.buildInvalidEmailTokenMsg(token),
    userError.ErrorType.InvalidEmailConfirmToken,
  )
  return repositories.user.findByEmailConfirmationToken(token)
    .then(fp.tapRejectIfEmpty<entity.User>(invalidTokenError))
    .then((user) => repositories.user.save({
      ...user,
      isEmailConfirmed: true,
      confirmEmailToken: null,
      confirmEmailTokenExpiresAt: null,
    }))
    .then((user) => {
      if (isEmpty(user.referredBy)) {
        return
      }

      return repositories.user.findById(user.referredBy)
        .then((otherUser) => {
          return repositories.edge.save({
            thisEntityId: otherUser.id,
            thisEntityType: misc.EntityType.User,
            thatEntityId: user.id,
            thatEntityType: misc.EntityType.User,
            edgeType: misc.EdgeType.Referred,
          })
            .then(() => coreService.countEdges(ctx, {
              thisEntityId: otherUser.id,
              edgeType: misc.EdgeType.Referred,
            }))
            .then((count) => sendgrid.sendReferredBy(otherUser, count))
        })
    })
    .then(() => true)
}

const updateMe = (
  _: any,
  args: gql.MutationUpdateMeArgs,
  ctx: Context,
): Promise<gql.User> => {
  const { user, repositories } = ctx
  logger.debug('updateMe', { loggedInUserId: user.id, input: args.input })

  const schema = Joi.object().keys({
    avatarURL: Joi.string(),
  })
  validateSchema(schema, args.input)

  const { avatarURL = '' } = args.input
  // TODO notify user?
  return repositories.user.updateOneById(user.id, { avatarURL })
}

const getMyAddresses = (
  parent: gql.User,
  _: unknown,
  ctx: Context,
): Promise<gql.Wallet[]> => {
  const { user, repositories } = ctx
  logger.debug('getMyAddresses', { userId: parent.id, loggedInUserId: user.id })
  if (user.id !== parent.id) {
    return null
  }
  return repositories.wallet.findByUserId(parent.id)
}

const getMyApprovals = (
  parent: gql.User,
  _: unknown,
  ctx: Context,
): Promise<gql.Approval[]> => {
  const { user, repositories } = ctx
  logger.debug('getMyApprovals', { userId: parent.id, loggedInUserId: user.id })
  if (user.id !== parent.id) {
    return null
  }
  return repositories.approval.findByUserId(user.id)
}

export default {
  Query: {
    me: combineResolvers(isAuthenticated, coreService.resolveEntityFromContext('user')),
  },
  Mutation: {
    signUp,
    confirmEmail,
    updateMe: combineResolvers(isAuthenticated, updateMe),
  },
  User: {
    myAddresses: combineResolvers(isAuthenticated, getMyAddresses),
    myApprovals: combineResolvers(isAuthenticated, getMyApprovals),
  },
}
