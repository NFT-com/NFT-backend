import cryptoRandomString from 'crypto-random-string'
import { addDays } from 'date-fns'
import { combineResolvers } from 'graphql-resolvers'
import Joi from 'joi'

import { Context, gql } from '@nftcom/gql/defs'
import { appError, userError, walletError } from '@nftcom/gql/error'
import { auth, joi } from '@nftcom/gql/helper'
import { core, sendgrid } from '@nftcom/gql/service'
import { _logger, defs, entity, fp, helper } from '@nftcom/shared'

const logger = _logger.Factory(_logger.Context.User, _logger.Context.GraphQL)

const signUp = (
  _: any,
  args: gql.MutationSignUpArgs,
  ctx: Context,
): Promise<gql.User> => {
  const { repositories } = ctx
  logger.debug('signUp', { input: args.input })

  const schema = Joi.object().keys({
    avatarURL: Joi.string(),
    email: Joi.string().email(),
    username: Joi.string(),
    referredBy: Joi.string(),
    wallet: joi.buildWalletInputSchema(),
  })
  joi.validateSchema(schema, args.input)

  const { email, username, avatarURL, referredBy = '', wallet } = args.input
  const { address, network, chainId } = wallet
  const chain = auth.verifyAndGetNetworkChain(network, chainId)

  return Promise.all([
    repositories.user.exists({ username, email }),
    repositories.wallet.exists({ network, chainId, address }),
  ])
    .then(([userExists, addressExists]) => {
      if (userExists) {
        return Promise.reject(appError.buildExists(
          userError.buildUsernameExistsMsg(username),
          userError.ErrorType.UsernameAlreadyExists,
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
    .then(fp.thruIfNotEmpty((refId: string) => {
      return repositories.user.findByReferralId(refId)
        .then((user) => user?.id)
    }))
    .then((referredUserId: string) => {
      const confirmEmailToken = cryptoRandomString({ length: 6, type: 'numeric' })
      const confirmEmailTokenExpiresAt = addDays(helper.toUTCDate(), 1)
      const referralId = cryptoRandomString({ length: 10, type: 'url-safe' })

      return repositories.user.save({
        email,
        username,
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

const updateEmail = (
  _: any,
  args: gql.MutationSignUpArgs,
  ctx: Context,
): Promise<entity.User> => {
  const { user, repositories } = ctx
  logger.debug('updateEmail', { input: args.input })

  const schema = Joi.object().keys({
    email: Joi.string().email().required(),
  })
  joi.validateSchema(schema, args.input)

  const { email } = args.input

  const confirmEmailToken = cryptoRandomString({ length: 6, type: 'numeric' })
  const confirmEmailTokenExpiresAt = addDays(helper.toUTCDate(), 1)
  return repositories.user.save({
    ...user,
    email,
    confirmEmailToken,
    confirmEmailTokenExpiresAt,
  })
    .then(fp.tapWait(sendgrid.sendConfirmEmail))
}

const updateReferral = (ctx: Context) => {
  return (otherUser: entity.User): Promise<boolean> => {
    const { user } = ctx
    return core.createEdge(ctx,{
      thisEntityId: otherUser.id,
      thisEntityType: defs.EntityType.User,
      thatEntityId: user.id,
      thatEntityType: defs.EntityType.User,
      edgeType: defs.EdgeType.Referred,
    })
      .then(() => core.countEdges(ctx, {
        thisEntityId: otherUser.id,
        edgeType: defs.EdgeType.Referred,
      }))
      .then((count) => sendgrid.sendReferredBy(otherUser, count))
  }
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
  joi.validateSchema(schema, args)

  const { token } = args
  const invalidTokenError = appError.buildInvalid(
    userError.buildInvalidEmailTokenMsg(token),
    userError.ErrorType.InvalidEmailConfirmToken,
  )
  return repositories.user.findByEmailConfirmationToken(token)
    .then(fp.rejectIfEmpty(invalidTokenError))
    .then((user) => repositories.user.save({
      ...user,
      isEmailConfirmed: true,
      confirmEmailToken: null,
      confirmEmailTokenExpiresAt: null,
    }))
    .then((user) => {
      if (helper.isEmpty(user.referredBy)) {
        return user
      }
      return repositories.user.findById(user.referredBy)
        .then(fp.tap(updateReferral(ctx)))
    })
    .then(() => true)
}

const buildPreferencesInputSchema = (): Joi.ObjectSchema =>
  Joi.object().keys({
    bidActivityNotifications: Joi.boolean().required(),
    priceChangeNotifications: Joi.boolean().required(),
    outbidNotifications: Joi.boolean().required(),
    purchaseSuccessNotifications: Joi.boolean().required(),
    promotionalNotifications: Joi.boolean().required(),
    nftSoldNotifications: Joi.boolean().required(),
    nftListingChangeNotifications: Joi.boolean().required(),
    nftOwnerChangeNotifications: Joi.boolean().required(),
    nftNewBidNotifications: Joi.boolean().required(),
    collectionFloorChangeNotifications: Joi.boolean().required(),
    collectionAssetSoldNotifications: Joi.boolean().required(),
    collectionNewListingNotifications: Joi.boolean().required(),
  })

const updateMe = (
  _: any,
  args: gql.MutationUpdateMeArgs,
  ctx: Context,
): Promise<gql.User> => {
  const { user, repositories } = ctx
  logger.debug('updateMe', { loggedInUserId: user.id, input: args.input })

  const schema = Joi.object().keys({
    avatarURL: Joi.string(),
    email: Joi.string().email(),
    preferences: buildPreferencesInputSchema(),
  })

  joi.validateSchema(schema, args.input)

  const {
    avatarURL = user.avatarURL,
    email = user.email,
    preferences = user.preferences,
  } = args.input
  // TODO notify user?
  return repositories.user.updateOneById(user.id, { avatarURL, email, preferences })
}

const resendEmailConfirm = (
  _: any,
  args: any,
  ctx: Context,
): Promise<entity.User> => {
  const { user, repositories } = ctx
  logger.debug('resendEmailConfirm', { loggedInUserId: user.id })
  const confirmEmailToken = cryptoRandomString({ length: 6, type: 'numeric' })
  const confirmEmailTokenExpiresAt = addDays(helper.toUTCDate(), 1)
  return repositories.user.save({
    ...user,
    confirmEmailToken,
    confirmEmailTokenExpiresAt,
  })
    .then(fp.tapWait(sendgrid.sendConfirmEmail))
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
    me: combineResolvers(auth.isAuthenticated, core.resolveEntityFromContext('user')),
  },
  Mutation: {
    signUp,
    confirmEmail,
    updateEmail,
    updateMe: combineResolvers(auth.isAuthenticated, updateMe),
    resendEmailConfirm: combineResolvers(auth.isAuthenticated, resendEmailConfirm),
  },
  User: {
    myAddresses: combineResolvers(auth.isAuthenticated, getMyAddresses),
    myApprovals: combineResolvers(auth.isAuthenticated, getMyApprovals),
  },
}
