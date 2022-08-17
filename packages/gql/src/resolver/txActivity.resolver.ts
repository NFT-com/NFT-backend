import { combineResolvers } from 'graphql-resolvers'
import { In, UpdateResult } from 'typeorm'

import { Context, gql } from '@nftcom/gql/defs'
import { appError, txActivityError } from '@nftcom/gql/error'
import { auth } from '@nftcom/gql/helper'
import { TxActivity } from '@nftcom/shared/db/entity'
import { ActivityType } from '@nftcom/shared/defs'

interface UpdatedIds {
  id: string
}

const updateReadByIds = async (_: any, args: gql.MutationUpdateReadByIdsArgs, ctx: Context)
: Promise<gql.UpdateReadOutput> => {
  const activities: gql.UpdateReadOutput = {
    updatedIdsSuccess: [],
    idsNotFoundOrFailed: [],
  }
  const { repositories, chain, wallet } = ctx
  const { ids } = args
  if (!ids.length) {
    return Promise.reject(
      appError.buildInvalid(
        txActivityError.buildNoActivityId(),
        txActivityError.ErrorType.ActivityNotSet,
      ),
    )
  }

  let ownedActivities: TxActivity[] = []

  if (wallet.address) {
    // check ids are owned by wallet
    ownedActivities = await repositories.txActivity.find({
      where: {
        id: In(ids),
        chainId: chain.id,
        read: false,
        walletId: wallet.address,
      },
    })
  }

  if (!ownedActivities.length) {
    return Promise.reject(
      appError.buildInvalid(
        txActivityError.buildNoActivitiesToUpdate(),
        txActivityError.ErrorType.NoActivityToUpdate,
      ),
    )
  }

  const ownedIds: string[] = ownedActivities.map((ownedActivity: TxActivity) => ownedActivity.id)
  
  const updatedIds: UpdateResult = await repositories.txActivity.updateActivities(
    ownedIds,
    wallet.address,
    chain.id)
  activities.updatedIdsSuccess = updatedIds?.raw?.map(
    (item: UpdatedIds) => item.id,
  )
  activities.idsNotFoundOrFailed = ids.filter(
    (id: string) => !activities.updatedIdsSuccess.includes(id),
  )
  return activities
}

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
    getActivitiesByWalletId: combineResolvers(
      auth.isAuthenticated,
      getActivitiesByWalletId,
    ),
    getActivitiesByWalletIdAndType: combineResolvers(
      auth.isAuthenticated,
      getActivitiesByWalletIdAndType,
    ),
  },
  Mutation: {
    updateReadByIds: combineResolvers(
      auth.isAuthenticated,
      updateReadByIds,
    ),
  },
}