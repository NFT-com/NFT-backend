import { combineResolvers } from 'graphql-resolvers'

import { Context } from '@src/db'
import { EntityType, gqlTypes } from '@src/defs'
import { appError } from '@src/graphql/error'
import { LoggerContext, LoggerFactory } from '@src/helper/logger'

import { isAuthenticated, verifyAndGetNetworkChain } from './auth'
import { buildWalletInputSchema } from './joi'
import * as service from './service'

const logger = LoggerFactory(LoggerContext.GraphQL, LoggerContext.Wallet)

const addAddress = (
  _: any,
  args: gqlTypes.MutationAddAddressArgs,
  ctx: Context,
): Promise<gqlTypes.Wallet> => {
  const { user, repositories } = ctx
  logger.debug('addAddress', { loggedInUserId: user.id, input: args.input })

  const schema = buildWalletInputSchema()
  const { error } = schema.validate(args.input, { abortEarly: false })
  if (error) {
    throw appError.buildInvalidSchemaError(error)
  }

  const { address, chainId, network } = args.input
  const chain = verifyAndGetNetworkChain(network, chainId)
  return service.getWallet(ctx, args.input)
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
    user: service.resolveEntityById('userId', EntityType.Wallet, EntityType.User),
  },
}
