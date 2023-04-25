import { combineResolvers } from 'graphql-resolvers'
import Joi from 'joi'

import { Context } from '@nftcom/misc'
import { auth, joi } from '@nftcom/misc'
import { core } from '@nftcom/service'
import { _logger, defs, entity, helper } from '@nftcom/shared'

import { gql } from '../defs'

const logger = _logger.Factory(_logger.Context.Approval, _logger.Context.GraphQL)

const approveAmount = (_: any, args: gql.MutationApproveAmountArgs, ctx: Context): Promise<gql.Approval> => {
  const { user, repositories } = ctx
  logger.debug('approveAmount', { loggedInUserId: user.id, input: args.input })

  const schema = Joi.object().keys({
    amount: Joi.required().custom(joi.buildBigNumber),
    currency: Joi.string().required(),
    deadline: Joi.string().required(),
    nonce: Joi.number().required(),
    signature: joi.buildSignatureInputSchema(),
    spender: Joi.string().required(),
    txHash: Joi.string().required(),
    wallet: joi.buildWalletInputSchema(),
  })
  const { input } = args
  joi.validateSchema(schema, input)
  return core.getWallet(ctx, input.wallet).then(({ id: walletId }) =>
    repositories.approval.save({
      amount: helper.bigNumberToString(input.amount),
      currency: input.currency,
      deadline: input.deadline,
      nonce: input.nonce,
      signature: input.signature,
      userId: user.id,
      walletId,
      spender: input.spender,
      txHash: input.txHash,
    }),
  )
}

export default {
  Mutation: {
    approveAmount: combineResolvers(auth.isAuthenticated, approveAmount),
  },
  Approval: {
    wallet: core.resolveEntityById<gql.Approval, entity.Wallet>(
      'walletId',
      defs.EntityType.Approval,
      defs.EntityType.Wallet,
    ),
  },
}
