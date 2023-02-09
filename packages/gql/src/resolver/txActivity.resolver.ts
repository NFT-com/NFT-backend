import { BigNumber } from 'ethers'
import { combineResolvers } from 'graphql-resolvers'
import Joi from 'joi'
import { In, Not, UpdateResult } from 'typeorm'

import { appError, txActivityError } from '@nftcom/error-types'
import { Context, gql } from '@nftcom/gql/defs'
import { auth, joi, pagination } from '@nftcom/gql/helper'
import { core } from '@nftcom/gql/service'
import { paginatedActivitiesBy } from '@nftcom/gql/service/txActivity.service'
import { defs, entity, helper } from '@nftcom/shared'
import * as Sentry from '@sentry/node'

type TxActivityDAO = entity.TxActivity & {
  transaction: entity.TxTransaction
}

interface UpdatedIds {
  id: string
}

// only update to fulfilled or cancelled allowed
const updateStatusByIds = async (_: any, args: gql.MutationUpdateStatusByIdsArgs, ctx: Context)
: Promise<gql.UpdateReadOutput> => {
  const activities: gql.UpdateReadOutput = {
    updatedIdsSuccess: [],
    idsNotFoundOrFailed: [],
  }
  const { repositories, chain, wallet } = ctx
  const { ids, status } = args

  if (!ids.length) {
    return Promise.reject(
      appError.buildInvalid(
        txActivityError.buildNoActivityId(),
        txActivityError.ErrorType.ActivityNotSet,
      ),
    )
  }

  if(!Object.keys(defs.ActivityStatus).includes(status)) {
    return Promise.reject(
      appError.buildInvalid(
        txActivityError.buildIncorrectStatus(status),
        txActivityError.ErrorType.StatusNotAllowed,
      ),
    )
  }

  if(status === defs.ActivityStatus.Valid) {
    return Promise.reject(
      appError.buildInvalid(
        txActivityError.buildStatusNotAllowed(status),
        txActivityError.ErrorType.StatusNotAllowed,
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
        status: Not(status),
        walletAddress,
      },
    })
  }

  if (!ownedActivities.length) {
    return Promise.reject(
      appError.buildInvalid(
        txActivityError.buildNoActivitiesStatusToUpdate(),
        txActivityError.ErrorType.NoActivityToUpdate,
      ),
    )
  }

  const ownedIds: string[] = ownedActivities.map(
    (ownedActivity: entity.TxActivity) => ownedActivity.id,
  )

  const filters: defs.ActivityFilters = {
    walletAddress,
    chainId: chain.id,
  }
  const updatedIds: UpdateResult = await repositories.txActivity.updateActivities(
    ownedIds,
    filters,
    'status',
    status)
  activities.updatedIdsSuccess = updatedIds?.raw?.map(
    (item: UpdatedIds) => item.id,
  )
  activities.idsNotFoundOrFailed = ids.filter(
    (id: string) => !activities.updatedIdsSuccess.includes(id),
  )
  return activities
}

const updateReadByIds = async (_: any, args: gql.MutationUpdateReadByIdsArgs, ctx: Context)
: Promise<gql.UpdateReadOutput> => {
  const activities: gql.UpdateReadOutput = {
    updatedIdsSuccess: [],
    idsNotFoundOrFailed: [],
  }
  const { repositories, chain, wallet } = ctx
  const { ids } = args

  let ownedActivities: entity.TxActivity[] = []

  const walletAddress: string = helper.checkSum(wallet.address)

  if (walletAddress) {
    // check ids are owned by wallet
    if(ids.length) {
      ownedActivities = await repositories.txActivity.find({
        where: {
          id: In(ids),
          chainId: chain.id,
          read: false,
          walletAddress,
        },
      })

      if (!ownedActivities.length) {
        return Promise.reject(
          appError.buildInvalid(
            txActivityError.buildNoActivitiesReadToUpdate(),
            txActivityError.ErrorType.NoActivityToUpdate,
          ),
        )
      }
    }
  }

  const ownedIds: string[] = ownedActivities.length ?  ownedActivities.map(
    (ownedActivity: entity.TxActivity) => ownedActivity.id,
  ) : []

  const filters: defs.ActivityFilters = {
    walletAddress,
    chainId: chain.id,
  }
  const updatedIds: UpdateResult = await repositories.txActivity.updateActivities(
    ownedIds,
    filters,
    'read',
    true)
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

  const schema = Joi.object().keys({
    input: Joi.object().required().keys({
      pageInput: Joi.any().required(),
      walletAddress: Joi.string(),
      activityType: Joi.string(),
      status: Joi.string(),
      read: Joi.boolean(),
      tokenId: Joi.custom(joi.buildBigNumber),
      contract: Joi.string(),
      chainId: Joi.string(),
      skipRelations: Joi.boolean(),
      expirationType: Joi.string(),
    }),
  })

  joi.validateSchema(schema, args)
  const {
    pageInput,
    walletAddress,
    activityType,
    status,
    read,
    tokenId,
    contract,
    skipRelations,
    expirationType,
  } = helper.safeObject(args.input)

  if (!process.env.ACTIVITY_ENDPOINTS_ENABLED) {
    return {
      items: [],
      totalItems: 0,
      pageInfo: {
        firstCursor: '',
        lastCursor: '',
      },
    }
  }

  const chainId: string =  args.input?.chainId || process.env.CHAIN_ID
  const verificationNetwork: string = network || 'ethereum'
  let checksumContract: string

  auth.verifyAndGetNetworkChain(verificationNetwork, chainId)

  let filters: defs.ActivityFilters = { chainId, status: defs.ActivityStatus.Valid }

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

  if(status && status !== defs.ActivityStatus.Valid) {
    const castedStatus: defs.ActivityStatus = status
    if(!Object.values(defs.ActivityStatus).includes(castedStatus)) {
      return Promise.reject(appError.buildInvalid(
        txActivityError.buildIncorrectStatus(castedStatus),
        txActivityError.ErrorType.StatusIncorrect,
      ))
    }
    filters = { ...filters, status: castedStatus }
  }

  let nftId: string
  // build nft id
  if (contract) {
    checksumContract = helper.checkSum(contract)
    filters = { ...filters, nftContract: contract }
  }

  if (!contract && tokenId) {
    return Promise.reject(appError.buildInvalid(
      txActivityError.buildTokenWithNoContract(),
      txActivityError.ErrorType.TokenWithNoContract,
    ))
  }
  if (contract && tokenId) {
    nftId = `ethereum/${checksumContract}/${BigNumber.from(tokenId).toHexString()}`
  }

  if(nftId?.length) {
    filters = { ...filters, nftId }
  }

  // by default expired items are included
  if (!expirationType || expirationType === gql.ActivityExpiration.Active) {
    filters = { ...filters, expiration: helper.moreThanDate(new Date().toString()) }
  } else if (expirationType === gql.ActivityExpiration.Expired){
    filters = { ...filters, expiration: helper.lessThanDate(new Date().toString()) }
  }

  let safefilters
  if (read !== undefined) {
    safefilters = [{ ...helper.inputT2SafeK(filters),  read }]
  } else {
    safefilters = [helper.inputT2SafeK(filters)]
  }

  if (skipRelations) {
    return core.paginatedEntitiesBy(
      repositories.txActivity,
      pageInput,
      safefilters,
      [],
      'createdAt',
      'DESC',
    )
      .then(pagination.toPageable(pageInput, null, null, 'createdAt'))
  }

  return paginatedActivitiesBy(
    repositories.txActivity,
    pageInput,
    safefilters,
    [],
    'createdAt',
    'DESC',
  )
    .then(pagination.toPageable(pageInput, null, null, 'createdAt'))
}

const fulfillActivitiesNFTId = async (
  _: any,
  args: gql.MutationFulfillActivitiesNFTIdArgs,
  ctx: Context,
): Promise<gql.FulfillActivitiesNFTIdOutput> => {
  const { repositories } = ctx
  try {
    const count = Math.min(Number(args?.count), 1000)
    const activities = await repositories.txActivity.findActivitiesWithEmptyNFT(
      defs.ActivityType.Sale,
    )
    const slicedActivities = activities.slice(0, count)
    await Promise.allSettled(
      slicedActivities.map(async (activity) => {
        const activityDAO = activity as TxActivityDAO
        if (activityDAO.transaction) {
          const orderHash = activityDAO.activityTypeId.split(':')[1]
          const orderActivity = await repositories.txActivity.findOne({
            where: {
              activityTypeId: orderHash,
              activityType: defs.ActivityType.Listing,
            },
          })
          if (orderActivity) {
            await repositories.txActivity.updateOneById(activityDAO.id, {
              nftId: orderActivity.nftId,
              nftContract: orderActivity.nftContract,
            })
          }
        }
      }),
    )
    return {
      message: `Updated nftId of ${count} tx activities for NFTCOM`,
    }
  } catch (err) {
    Sentry.captureMessage(`Error in fulfillActivitiesNFTId: ${err}`)
    return err
  }
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
    updateStatusByIds: combineResolvers(
      auth.isAuthenticated,
      updateStatusByIds,
    ),
    fulfillActivitiesNFTId: combineResolvers(
      auth.isAuthenticated,
      fulfillActivitiesNFTId,
    ),
  },
  ProtocolData:{
    __resolveType(obj) {
      if (obj.signer) {
        return 'LooksrareProtocolData'
      }

      if (obj.id) {
        return 'X2Y2ProtocolData'
      }

      if (obj.salt) {
        return 'NFTCOMProtocolData'
      }

      return 'SeaportProtocolData'
    },
  },
  TxProtocolData:{
    __resolveType(obj) {
      if (obj.signer) {
        return 'TxLooksrareProtocolData'
      }

      if (obj.currency) {
        return 'TxX2Y2ProtocolData'
      }

      if (obj.offer) {
        return 'TxSeaportProtocolData'
      }

      return 'TxNFTCOMProtocolData'
    },
  },
}
