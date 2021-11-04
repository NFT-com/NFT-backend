import { combineResolvers } from 'graphql-resolvers'

import { Context } from '@src/db'
import { gql, misc } from '@src/defs'
import { appError } from '@src/graphql/error'
import { _logger } from '@src/helper'

import { isAuthenticated, verifyAndGetNetworkChain } from './auth'
import * as coreService from './core.service'
import { buildWalletInputSchema } from './joi'

const logger = _logger.Factory(_logger.Context.Wallet, _logger.Context.GraphQL)

const addAddress = (
  _: any,
  args: gql.MutationAddAddressArgs,
  ctx: Context,
): Promise<gql.Wallet> => {
  const { user, repositories } = ctx
  logger.debug('addAddress', { loggedInUserId: user.id, input: args.input })

  const schema = buildWalletInputSchema()
  const { error } = schema.validate(args.input, { abortEarly: false })
  if (error) {
    throw appError.buildInvalidSchema(error)
  }

  const { address, chainId, network } = args.input
  const chain = verifyAndGetNetworkChain(network, chainId)
  return coreService.getWallet(ctx, args.input)
    .then(() => repositories.wallet.save({
      address,
      chainId: chain.id,
      chainName: chain.name,
      network,
    }))
}

export default {
  Mutation: {
    addAddress: combineResolvers(isAuthenticated, addAddress),
  },
  Wallet: {
    user: coreService.resolveEntityById(
      'userId',
      misc.EntityType.Wallet,
      misc.EntityType.User,
    ),
  },
}
