import { ethers } from 'ethers'
import { combineResolvers } from 'graphql-resolvers'
import Joi from 'joi'

import { appError, profileError } from '@nftcom/error-types'
import { auth, Context, joi } from '@nftcom/misc'
import { core } from '@nftcom/service'
import { _logger, defs, entity, helper } from '@nftcom/shared'
import * as Sentry from '@sentry/node'

import { gql } from '../defs'

const logger = _logger.Factory(_logger.Context.Wallet, _logger.Context.GraphQL)

const addAddress = (_: any, args: gql.MutationAddAddressArgs, ctx: Context): Promise<gql.Wallet> => {
  const { user, repositories } = ctx
  logger.debug('addAddress', { loggedInUserId: user.id, input: args.input })

  const schema = joi.buildWalletInputSchema()
  const { error } = schema.validate(args.input, { abortEarly: false })
  if (error) {
    throw appError.buildInvalidSchema(error)
  }

  const { address, chainId, network } = args.input
  const chain = auth.verifyAndGetNetworkChain(network, chainId)
  return core.getWallet(ctx, args.input).then(() =>
    repositories.wallet.save({
      address: ethers.utils.getAddress(address),
      chainId: chain.id,
      chainName: chain.name,
      network,
    }),
  )
}

const isAddressWhitelisted = async (
  _: any,
  args: gql.QueryIsAddressWhitelistedArgs,
  ctx: Context,
): Promise<boolean> => {
  const { wallet } = ctx
  logger.debug('isAddressWhitelisted', { input: args.input, caller: wallet })
  const whitelist = helper.getGenesisKeyWhitelist()
  const ensList = helper.getEnsKeyWhitelist()

  const lowercasedWhitelist = whitelist.map(address => {
    try {
      return address?.toLowerCase()
    } catch (e) {
      Sentry.captureException(e)
      Sentry.captureMessage(`Error in isAddressWhitelisted: ${e}`)
      return address
    }
  })

  if (lowercasedWhitelist.includes(args.input?.address?.toLowerCase())) {
    return true
  } else {
    const ensAddress = await core.convertEthAddressToEns(args.input?.address)
    return Promise.resolve(ensList.includes(ensAddress))
  }
}

export const updateWalletProfileId = async (
  _: any,
  args: gql.MutationUpdateWalletProfileIdArgs,
  ctx: Context,
): Promise<gql.Wallet> => {
  const schema = Joi.object().keys({
    profileId: Joi.string().required(),
  })
  joi.validateSchema(schema, args)

  const { repositories, wallet } = ctx
  const { profileId } = args
  const profile = await repositories.profile.findById(profileId)

  if (!profile) {
    throw appError.buildNotFound(
      profileError.buildProfileNotFoundMsg(profileId),
      profileError.ErrorType.ProfileNotFound,
    )
  } else if (profile.ownerWalletId !== wallet.id) {
    throw appError.buildForbidden(
      profileError.buildProfileNotOwnedMsg(profile.id),
      profileError.ErrorType.ProfileNotOwned,
    )
  }

  return await repositories.wallet.updateOneById(wallet.id, {
    profileId: profile.id,
  })
}

export default {
  Query: {
    isAddressWhitelisted: isAddressWhitelisted,
  },
  Mutation: {
    addAddress: combineResolvers(auth.isAuthenticated, addAddress),
    updateWalletProfileId: combineResolvers(auth.isAuthenticated, updateWalletProfileId),
  },
  Wallet: {
    user: core.resolveEntityById<gql.Wallet, entity.User>('userId', defs.EntityType.Wallet, defs.EntityType.User),
    preferredProfile: core.resolveEntityById<gql.Wallet, entity.Profile>(
      'profileId',
      defs.EntityType.Wallet,
      defs.EntityType.Profile,
    ),
  },
}
