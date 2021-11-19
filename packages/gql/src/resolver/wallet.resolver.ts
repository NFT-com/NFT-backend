import { combineResolvers } from 'graphql-resolvers'

import { Context, gql } from '@nftcom/gql/defs'
import { appError } from '@nftcom/gql/error'
import { auth, joi } from '@nftcom/gql/helper'
import { core } from '@nftcom/gql/service'
import { _logger, defs, entity } from '@nftcom/shared'

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
      address,
      chainId: chain.id,
      chainName: chain.name,
      network,
    }))
}

export default {
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
