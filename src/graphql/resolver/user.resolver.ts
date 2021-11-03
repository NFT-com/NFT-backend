import { addDays } from 'date-fns'
import { combineResolvers } from 'graphql-resolvers'
import Joi from 'joi'
import { isEmpty } from 'lodash'

import { Context } from '@src/db'
import { gqlTypes } from '@src/defs'
import { appError, userError, walletError } from '@src/graphql/error'
import { fp } from '@src/helper'
import { LoggerContext, LoggerFactory } from '@src/helper/logger'

import { isAuthenticated } from './auth'
import * as service from './service'

const logger = LoggerFactory(LoggerContext.GraphQL, LoggerContext.User)

// type UserOut = gqlTypes.User & entity.User

const signUp = (
  _: any,
  args: gqlTypes.MutationSignUpArgs,
  ctx: Context,
): Promise<gqlTypes.User> => {
  const { chain, network, repositories } = ctx
  logger.debug('signUp', { network, chain, address: args.input.address })

  const schema = Joi.object().keys({
    email: Joi.string().required(),
    address: Joi.string().required(),
    referredBy: Joi.string(),
    avatarURL: Joi.string(),
  })
  const { error } = schema.validate(args.input, { abortEarly: false })
  if (error) {
    throw appError.buildInvalidSchemaError(error)
  }

  const { email, address, avatarURL, referredBy } = {
    email: args.input.email,
    address: args.input.address,
    referredBy: args.input.referredBy || '',
    avatarURL: args.input.avatarURL || '',
  }

  return Promise.all([
    repositories.user.exists({ email }),
    repositories.wallet.exists({ network, chainId: chain.id, address }),
  ])
    .then(([userExists, addressExists]) => {
      if (userExists) {
        return Promise.reject(userError.buildEmailAlreadyExistsError(email))
      }
      if (addressExists) {
        return Promise.reject(walletError.buildAddressAlreadyExistsError(network, chain, address))
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
  args: gqlTypes.MutationConfirmEmailArgs,
  ctx: Context,
): Promise<boolean> => {
  const { repositories } = ctx
  const { token } = args
  if (isEmpty(token)) {
    return Promise.reject(userError.buildEmailConfirmTokenRequiredError())
  }
  return repositories.user.updateEmailConfirmation(token)
    .then(fp.tapRejectIfFalse(userError.buildInvalidEmailConfirmTokenError(token)))
}

// TODO do we need to limit this to only the logged in user?
//  meaning do not allow people to fetch other people's addresses
const getAddresses = (
  parent: gqlTypes.User,
  args: any,
  ctx: Context,
): Promise<gqlTypes.Wallet[]> => {
  const { user, repositories } = ctx
  logger.debug('getAddresses', { userId: parent.id, loggedInUserId: user.id })
  return repositories.wallet.findByUserId(parent.id)
}

const updateMe = (
  _: any,
  args: gqlTypes.MutationUpdateMeArgs,
  ctx: Context,
): Promise<gqlTypes.User> => {
  const { user, repositories } = ctx
  logger.debug('updateMe', { loggedInUserId: user.id, input: args.input })

  const schema = Joi.object().keys({
    referredBy: Joi.string(),
    avatarURL: Joi.string(),
  })
  const { error } = schema.validate(args.input, { abortEarly: false })
  if (error) {
    throw appError.buildInvalidSchemaError(error)
  }

  const { avatarURL, referredBy } = {
    referredBy: args.input.referredBy || '',
    avatarURL: args.input.avatarURL || '',
  }
  // TODO
  //  1) notify user who's referral was used
  //  2) do we need to notify user who got updated?
  return repositories.user.updateOneById(user.id, { referredBy, avatarURL })
}

export default {
  Query: {
    me: combineResolvers(isAuthenticated, service.resolveEntityFromContext('user')),
    // user: combineResolvers(auth.isAuthenticated, getUser),
  },
  Mutation: {
    signUp: signUp,
    confirmEmail,
    updateMe: combineResolvers(isAuthenticated, updateMe),
  },
  User: {
    addresses: getAddresses,
  },
}
