import { combineResolvers } from 'graphql-resolvers'
import Joi from 'joi'

import { Context } from '@src/db'
import { gql, misc } from '@src/defs'
import { _logger } from '@src/helper'

import { isAuthenticated } from './auth'
import * as coreService from './core.service'
import { buildSignatureInputSchema, buildWalletInputSchema, validateSchema } from './joi'

const logger = _logger.Factory(_logger.Context.GraphQL, _logger.Context.Approval)

const approveAmount = (
  _: any,
  args: gql.MutationApproveAmountArgs,
  ctx: Context,
): Promise<gql.Approval> => {
  const { user, repositories } = ctx
  logger.debug('approveAmount', { loggedInUserId: user.id, input: args.input })

  const schema = Joi.object().keys({
    amount: Joi.number().required().greater(0),
    deadline: Joi.string().required(),
    nonce: Joi.number().required(),
    signature: buildSignatureInputSchema(),
    spender: Joi.string().required(),
    txHash: Joi.string().required(),
    wallet: buildWalletInputSchema(),
  })
  validateSchema(schema, args)

  return coreService.getWallet(ctx, args.input.wallet)
    .then(({ id: walletId }) => repositories.approval.save({
      amount: args.input.amount,
      deadline: args.input.deadline,
      nonce: args.input.nonce,
      signature: args.input.signature,
      userId: user.id,
      walletId,
    }))
}

export default {
  Mutation: {
    approveAmount: combineResolvers(isAuthenticated, approveAmount),
  },
  Approval: {
    wallet: coreService.resolveEntityById(
      'walletId',
      misc.EntityType.Approval,
      misc.EntityType.Wallet,
    ),
  },
}
