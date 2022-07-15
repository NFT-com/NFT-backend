import { Context, gql } from '@nftcom/gql/defs'
import { TxActivity } from '@nftcom/shared/db/entity'
import { ActivityType } from '@nftcom/shared/defs'

const getActivitiesByType = (_: any, args: gql.QueryGetActivitiesByTypeArgs, ctx: Context)
: Promise<TxActivity[]> => {
  const { repositories } = ctx
  const activityType = ActivityType[args.activityType]
  const chainId = args.chainId || process.env.CHAIN_ID
  return repositories.txActivity.findActivitiesByType(activityType, chainId)
}

const getActivitiesByUserId = (_: any, args: gql.QueryGetActivitiesByUserIdArgs, ctx: Context)
: Promise<TxActivity[]> => {
  const { repositories } = ctx
  const chainId = args.chainId || process.env.CHAIN_ID
  return repositories.txActivity.findActivitiesByUserId(args.userId, chainId)
}

const getActivitiesByUserIdAndType = (
  _: any,
  args: gql.QueryGetActivitiesByUserIdAndTypeArgs,
  ctx: Context,
): Promise<TxActivity[]> => {
  const { repositories } = ctx
  const activityType = ActivityType[args.input.activityType]
  const chainId = args.input.chainId || process.env.CHAIN_ID
  return repositories.txActivity.findActivitiesByUserIdAndType(
    args.input.userId,
    activityType,
    chainId,
  )
}

export default {
  Query: {
    getActivitiesByType,
    getActivitiesByUserId,
    getActivitiesByUserIdAndType,
  },
}
