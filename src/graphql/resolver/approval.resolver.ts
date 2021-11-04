import { combineResolvers } from 'graphql-resolvers'
import Joi from 'joi'

import { Context } from '@src/db'
import { EntityType, gqlTypes } from '@src/defs'
import { LoggerContext, LoggerFactory } from '@src/helper/logger'

import { isAuthenticated } from './auth'
import { buildSignatureInputSchema, buildWalletInputSchema, validateSchema } from './joi'
import * as service from './service'

const logger = LoggerFactory(LoggerContext.GraphQL, LoggerContext.Approval)

const approveAmount = (
  _: any,
  args: gqlTypes.MutationApproveAmountArgs,
  ctx: Context,
): Promise<gqlTypes.Approval> => {
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

  return service.getWallet(ctx, args.input.wallet)
    .then(({  id: walletId }) => repositories.approval.save({
      amount: args.input.amount,
      deadline: args.input.deadline,
      nonce: args.input.nonce,
      signature: args.input.signature,
      userId: user.id,
      walletId,
    }))
}

// TODO implement pagination
const getMyApprovals = (
  _: any,
  args: gqlTypes.QueryMyApprovalsArgs,
  ctx: Context,
): Promise<gqlTypes.ApprovalsOutput> => {
  const { user, repositories } = ctx
  logger.debug('getMyApprovals', { loggedInUserId: user.id, input: args.input })

  return repositories.approval.findByUserId(user.id)
    .then((approvals) => ({
      approvals,
      pageInfo: null,
    }))
}

export default {
  Query: {
    myApprovals: combineResolvers(isAuthenticated, getMyApprovals),
  },
  Mutation: {
    approveAmount: combineResolvers(isAuthenticated, approveAmount),
  },
  Approval: {
    wallet: service.resolveEntityById('walletId', EntityType.Approval, EntityType.Wallet),
  },
}
