import { combineResolvers } from 'graphql-resolvers'

import { Context, gql } from '@nftcom/gql/defs'
import { auth } from '@nftcom/gql/helper'
import { _logger,defs, entity, helper } from '@nftcom/shared'
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

  let ownedActivities: entity.TxActivity[] = []

  const walletAddress: string = helper.checkSum(wallet.address)

  if (walletAddress) {
    // check ids are owned by wallet
    ownedActivities = await repositories.txActivity.find({
      where: {
        id: In(ids),
        chainId: chain.id,
        read: false,
        walletAddress,
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

  const ownedIds: string[] = ownedActivities.map(
    (ownedActivity: entity.TxActivity) => ownedActivity.id,
  )
  
  const updatedIds: UpdateResult = await repositories.txActivity.updateActivities(
    ownedIds,
    walletAddress,
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

const getActivities = (
  _: any,
  args: gql.TxActivitiesInput,
  ctx: Context,
): Promise<entity.TxActivity[]> => {
  const { repositories, wallet, network } = ctx
  const {  walletAddress,
    activityType,
    read,
    tokenId,
    contract,
  } = args

  const chainId: string =  args.chainId || process.env.chainId
  auth.verifyAndGetNetworkChain(network, chainId)
  if (walletAddress !== wallet.address) {
    // build error
    return
  }

  let condition: defs.ActivityFilters = { walletAddress, chainId }

  if(activityType) {
    const castedActivityType: ActivityType = activityType as ActivityType
    if (!Object.values(ActivityType).includes(castedActivityType)) {
      //build error
      return
    }
    condition = { ...condition, activityType: castedActivityType }
  }

  // build nft id
  if (contract) {
    condition = { ...condition, contract }
  }

  if (tokenId) {
    // throw error if contract is absent
    if(!condition.contract) {
      return
    }
    condition = { ...condition, tokenId }
  }

  if (read) {
    condition = { ...condition, read }
  }

  return repositories.txActivity.findActivities(condition)
}

export default {
  Query: {
    getActivities: combineResolvers(
      auth.isAuthenticated,
      getActivities,
    ),
    getActivitiesByType,
    getActivitiesByWalletId,
    getActivitiesByWalletIdAndType,
  },
  Mutation: {
    updateReadByIds: combineResolvers(
      auth.isAuthenticated,
      updateReadByIds,
    ),
  },
}
