import { ethers } from 'ethers'
import { combineResolvers } from 'graphql-resolvers'

import { Context, gql } from '@nftcom/gql/defs'
import { appError } from '@nftcom/gql/error'
import { auth, joi } from '@nftcom/gql/helper'
import { core } from '@nftcom/gql/service'
import { _logger, defs, entity, helper } from '@nftcom/shared'

const logger = _logger.Factory(_logger.Context.Wallet, _logger.Context.GraphQL)

const addAddress = (
  _: any,
  args: gql.MutationAddAddressArgs,
  ctx: Context,
): Promise<gql.Wallet> => {
  const { user, repositories } = ctx
  logger.debug('addAddress', { loggedInUserId: user.id, input: args.input })

  const schema = joi.buildWalletInputSchema()
  const { error } = schema.validate(args.input, { abortEarly: false })
  if (error) {
    throw appError.buildInvalidSchema(error)
  }

  const { address, chainId, network } = args.input
  const chain = auth.verifyAndGetNetworkChain(network, chainId)
  return core.getWallet(ctx, args.input)
    .then(() => repositories.wallet.save({
      address: ethers.utils.getAddress(address),
      chainId: chain.id,
      chainName: chain.name,
      network,
    }))
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

  const lowercasedWhitelist = whitelist.map(
    (address) => {
      try {
        return address?.toLowerCase()
      } catch (e) {
        return address
      }
    },
  )

  try {
    if (lowercasedWhitelist.includes(args.input?.address?.toLowerCase())) {
      return true
    }
    throw new Error('pure address not whitelisted')
  } catch (e) {
    const ensAddress = await core.convertEthAddressToEns(args.input?.address)
    logger.debug('ensAddress: ', ensAddress)
    return Promise.resolve(ensList.includes(ensAddress))
  }
}

export default {
  Query: {
    isAddressWhitelisted: isAddressWhitelisted,
  },
  Mutation: {
    addAddress: combineResolvers(auth.isAuthenticated, addAddress),
  },
  Wallet: {
    user: core.resolveEntityById<gql.Wallet, entity.User>(
      'userId',
      defs.EntityType.Wallet,
      defs.EntityType.User,
    ),
  },
}
