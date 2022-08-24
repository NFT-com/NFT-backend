import { BigNumber } from 'ethers'
import { combineResolvers } from 'graphql-resolvers'
import { In, UpdateResult } from 'typeorm'

import { Context, gql } from '@nftcom/gql/defs'
import { appError, txActivityError } from '@nftcom/gql/error'
import { auth, pagination } from '@nftcom/gql/helper'
import { core } from '@nftcom/gql/service'
import { paginatedActivitiesBy } from '@nftcom/gql/service/txActivity.service'
import { _logger,defs, entity, helper } from '@nftcom/shared'

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
: Promise<entity.TxActivity[]> => {
  const { repositories } = ctx
  const activityType = defs.ActivityType[args.activityType]
  const chainId = args?.chainId || process.env.CHAIN_ID
  auth.verifyAndGetNetworkChain('ethereum', chainId)
  return repositories.txActivity.findActivitiesByType(activityType, chainId)
}

const getActivitiesByWalletAddress = (
  _: any,
  args: gql.QueryGetActivitiesByWalletAddressArgs, ctx: Context,
)
: Promise<entity.TxActivity[]> => {
  const { repositories } = ctx
  const chainId = args?.chainId || process.env.CHAIN_ID
  auth.verifyAndGetNetworkChain('ethereum', chainId)

  const walletAddress: string = helper.checkSum(args.walletAddress)
  return repositories.txActivity.findActivitiesByWalletAddress(walletAddress, chainId)
}

const getActivitiesByWalletAddressAndType = (
  _: any,
  args: gql.QueryGetActivitiesByWalletAddressAndTypeArgs,
  ctx: Context,
): Promise<entity.TxActivity[]> => {
  const { repositories } = ctx
  const activityType = defs.ActivityType[args.input.activityType]
  const chainId = args.input.chainId || process.env.CHAIN_ID
  auth.verifyAndGetNetworkChain('ethereum', chainId)

  const walletAddress: string = helper.checkSum(args.input?.walletAddress)

  return repositories.txActivity.findActivitiesByWalletAddressAndType(
    walletAddress,
    activityType,
    chainId,
  )
}

const getActivities = async (
  _: any,
  args: gql.QueryGetActivitiesArgs,
  ctx: Context,
): Promise<any> => {
  const { repositories, network } = ctx

  if (!args.input) {
    return Promise.reject(appError.buildInvalid(
      txActivityError.buildNullInput(),
      txActivityError.ErrorType.NullInput,
    ))
  }
  const {
    pageInput,
    walletAddress,
    activityType,
    read,
    tokenId,
    contract,
    skipRelations,
  } = args.input

  const chainId: string =  args.input?.chainId || process.env.CHAIN_ID

  auth.verifyAndGetNetworkChain(network, chainId)

  let filters: any = { chainId }

  if (walletAddress) {
    const walletAddressVerifed: string = helper.checkSum(walletAddress)
    filters = { ...filters, walletAddress: walletAddressVerifed }
  }

  if(activityType) {
    const castedActivityType: defs.ActivityType = activityType as defs.ActivityType
    if (!Object.values(defs.ActivityType).includes(castedActivityType)) {
      return Promise.reject(appError.buildInvalid(
        txActivityError.buildIncorrectActivity(castedActivityType),
        txActivityError.ErrorType.ActivityIncorrect,
      ))
    }
    filters = { ...filters, activityType: castedActivityType }
  }

  let nftId: string
  // build nft id
  if (contract && !tokenId) {
    return Promise.reject(appError.buildInvalid(
      txActivityError.buildCollectionNotSupported(),
      txActivityError.ErrorType.CollectionNotSupported,
    ))
  }

  if (!contract && tokenId) {
    return Promise.reject(appError.buildInvalid(
      txActivityError.buildTokenWithNoContract(),
      txActivityError.ErrorType.TokenWithNoContract,
    ))
  }
  if (contract && tokenId) {
    nftId = `ethereum/${contract}/${BigNumber.from(tokenId).toHexString()}`
  }

  if(nftId?.length) {
    filters = { nftId }
  }

  if (read) {
    filters = { ...filters, read }
  }

  const safefilters = [helper.inputT2SafeK(filters)]

  if (skipRelations) {
    return core.paginatedEntitiesBy(
      repositories.txActivity,
      pageInput,
      safefilters,
      [],
      'updatedAt',
      'DESC',
    )
      .then(pagination.toPageable(pageInput, null, null, 'updatedAt'))
  }

  return paginatedActivitiesBy(
    repositories.txActivity,
    pageInput,
    safefilters,
    [],
    'updatedAt',
    'DESC',
  )
    .then(pagination.toPageable(pageInput, null, null, 'updatedAt'))
}

export default {
  Query: {
    getActivities,
    getActivitiesByType,
    getActivitiesByWalletAddress: combineResolvers(
      auth.isAuthenticated,
      getActivitiesByWalletAddress,
    ),
    getActivitiesByWalletAddressAndType: combineResolvers(
      auth.isAuthenticated,
      getActivitiesByWalletAddressAndType,
    ),
  },
  Mutation: {
    updateReadByIds: combineResolvers(
      auth.isAuthenticated,
      updateReadByIds,
    ),
  },
}
