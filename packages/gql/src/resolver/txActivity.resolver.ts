import { Context, gql } from '@nftcom/gql/defs'
import { auth } from '@nftcom/gql/helper'
import { TxActivity } from '@nftcom/shared/db/entity'
import { ActivityType } from '@nftcom/shared/defs'

const getActivitiesByType = (_: any, args: gql.QueryGetActivitiesByTypeArgs, ctx: Context)
: Promise<TxActivity[]> => {
  const { repositories } = ctx
  const activityType = ActivityType[args.activityType]
  const chainId = args?.chainId || process.env.CHAIN_ID
  auth.verifyAndGetNetworkChain('ethereum', chainId)
  return repositories.txActivity.findActivitiesByType(activityType, chainId)
}

const getActivitiesByWalletId = (_: any, args: gql.QueryGetActivitiesByWalletIdArgs, ctx: Context)
: Promise<TxActivity[]> => {
  const { repositories } = ctx
  const chainId = args?.chainId || process.env.CHAIN_ID
  auth.verifyAndGetNetworkChain('ethereum', chainId)

  return repositories.txActivity.findActivitiesByWalletId(args.walletId, chainId)
}

const getActivitiesByWalletIdAndType = (
  _: any,
  args: gql.QueryGetActivitiesByWalletIdAndTypeArgs,
  ctx: Context,
): Promise<TxActivity[]> => {
  const { repositories } = ctx
  const activityType = ActivityType[args.input.activityType]
  const chainId = args.input.chainId || process.env.CHAIN_ID
  auth.verifyAndGetNetworkChain('ethereum', chainId)

  return repositories.txActivity.findActivitiesByWalletIdAndType(
    args.input.walletId,
    activityType,
    chainId,
  )
}

export default {
  Query: {
    getActivitiesByType,
    getActivitiesByWalletId,
    getActivitiesByWalletIdAndType,
  },
}
