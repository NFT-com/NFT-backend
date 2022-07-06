import { Context, gql } from '@nftcom/gql/defs'
import { TxActivity } from '@nftcom/shared/db/entity'
import { ActivityType } from '@nftcom/shared/defs'

const getActivitiesByType = (_: any, args: gql.QueryTxActivityArgs, ctx: Context)
: Promise<TxActivity[]> => {
  const { repositories } = ctx
  const activityType = ActivityType[args.activityType]
  console.log('activityType', activityType)

  return repositories.txActivity.findActivitiesByType(activityType)
}

const getActivitiesByUserId = (_: any, args: gql.QueryTxActivityArgs, ctx: Context)
: Promise<TxActivity[]> => {
  const { repositories } = ctx
  return repositories.txActivity.findActivitiesByUserId(args.userId)
}

const getActivitiesByUserIdAndType = (_: any, args: gql.QueryTxActivityInput, ctx: Context)
: Promise<TxActivity[]> => {
  const { repositories } = ctx
  const activityType = ActivityType[args.input.activityType]
  return repositories.txActivity.findActivitiesByUserIdAndType(args.input.userId, activityType)
}

export default {
  Query: {
    getActivitiesByType,
    getActivitiesByUserId,
    getActivitiesByUserIdAndType,
  },
}
