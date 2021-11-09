import { combineResolvers } from 'graphql-resolvers'
import Joi from 'joi'

import { Context } from '@src/db'
import { gql, misc } from '@src/defs'
import { _logger, helper } from '@src/helper'

import { isAuthenticated } from './auth'
import * as coreService from './core.service'
import {
  buildBigNumber,
  buildSignatureInputSchema,
  buildWalletInputSchema,
  validateSchema,
} from './joi'

const logger = _logger.Factory(_logger.Context.Approval, _logger.Context.GraphQL)

const approveAmount = (
  _: any,
  args: gql.MutationApproveAmountArgs,
  ctx: Context,
): Promise<gql.Approval> => {
  const { user, repositories } = ctx
  logger.debug('approveAmount', { loggedInUserId: user.id, input: args.input })

  const schema = Joi.object().keys({
    amount: Joi.required().custom(buildBigNumber),
    deadline: Joi.string().required(),
    nonce: Joi.number().required(),
    signature: buildSignatureInputSchema(),
    spender: Joi.string().required(),
    txHash: Joi.string().required(),
    wallet: buildWalletInputSchema(),
  })
  const { input } = args
  validateSchema(schema, input)

  return coreService.getWallet(ctx, input.wallet)
    .then(({ id: walletId }) => repositories.approval.save({
      amount: helper.bigNumberToNumber(input.amount),
      deadline: input.deadline,
      nonce: input.nonce,
      signature: input.signature,
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
