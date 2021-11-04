import { addDays } from 'date-fns'
import { combineResolvers } from 'graphql-resolvers'
import Joi from 'joi'
import { isEmpty } from 'lodash'

import { Context } from '@src/db'
import { gql } from '@src/defs'
import { appError, userError, walletError } from '@src/graphql/error'
import { _logger, fp } from '@src/helper'

import { isAuthenticated, verifyAndGetNetworkChain } from './auth'
import * as coreService from './core.service'
import { buildWalletInputSchema,validateSchema } from './joi'

const logger = _logger.Factory(_logger.Context.GraphQL, _logger.Context.User)

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

  const { email, avatarURL = '', referredBy = '', wallet } = args.input
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
    })
    .then(() => {
      // Random 6 digit code and expires next day
      const confirmEmailToken = Math.floor(100000 + Math.random() * 900000)
      const confirmEmailTokenExpiresAt = addDays(new Date(), 1)
      return repositories.user.save({
        email,
        referredBy,
        avatarURL,
        confirmEmailToken,
        confirmEmailTokenExpiresAt,
      })
      // TODO
      //  1) update referral count
      //  2) email user their confirm email token
      //  3) notify user who referred
    })
    .then(fp.tapWait((user) => repositories.wallet.save({
      userId: user.id,
      network,
      chainId: chain.id,
      chainName: chain.name,
      address,
    })))
}

const confirmEmail = (
  _: any,
  args: gql.MutationConfirmEmailArgs,
  ctx: Context,
): Promise<boolean> => {
  const { repositories } = ctx
  const { token } = args
  if (isEmpty(token)) {
    return Promise.reject(appError.buildInvalid(
      userError.buildEmailTokenRequiredMsg(),
      userError.ErrorType.EmailConfirmTokenRequired,
    ))
  }
  return repositories.user.updateEmailConfirmation(token)
    .then(fp.tapRejectIfFalse(appError.buildInvalid(
      userError.buildInvalidEmailTokenMsg(token),
      userError.ErrorType.InvalidEmailConfirmToken,
    )))
}

// TODO do we need to limit this to only the logged in user?
//  meaning do not allow people to fetch other people's addresses
const getAddresses = (
  parent: gql.User,
  args: any,
  ctx: Context,
): Promise<gql.Wallet[]> => {
  const { user, repositories } = ctx
  logger.debug('getAddresses', { userId: parent.id, loggedInUserId: user.id })
  return repositories.wallet.findByUserId(parent.id)
}

const updateMe = (
  _: any,
  args: gql.MutationUpdateMeArgs,
  ctx: Context,
): Promise<gql.User> => {
  const { user, repositories } = ctx
  logger.debug('updateMe', { loggedInUserId: user.id, input: args.input })

  const schema = Joi.object().keys({
    referredBy: Joi.string(),
    avatarURL: Joi.string(),
  })
  validateSchema(schema, args.input)

  const { avatarURL = '', referredBy = '' } = args.input
  // TODO
  //  1) notify user who's referral was used
  //  2) do we need to notify user who got updated?
  return repositories.user.updateOneById(user.id, { referredBy, avatarURL })
}

export default {
  Query: {
    me: combineResolvers(isAuthenticated, coreService.resolveEntityFromContext('user')),
    // user: combineResolvers(auth.isAuthenticated, getUser),
  },
  Mutation: {
    signUp,
    confirmEmail,
    updateMe: combineResolvers(isAuthenticated, updateMe),
  },
  User: {
    addresses: getAddresses,
  },
}
