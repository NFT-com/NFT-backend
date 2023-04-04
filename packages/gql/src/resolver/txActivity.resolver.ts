import { BigNumber } from 'ethers'
import { combineResolvers } from 'graphql-resolvers'
import Joi from 'joi'
import * as _lodash from 'lodash'
import { In, Not, UpdateResult } from 'typeorm'

import { cache, CacheKeys } from '@nftcom/cache'
import { appError, txActivityError } from '@nftcom/error-types'
import { Context, gql } from '@nftcom/gql/defs'
import { auth, joi, pagination } from '@nftcom/gql/helper'
import { core, openseaService } from '@nftcom/gql/service'
import { paginatedResultFromIndexedArray } from '@nftcom/gql/service/core.service'
import { contracts, defs, entity, helper } from '@nftcom/shared'
import { ActivityStatus, ActivityType } from '@nftcom/shared/defs'
import * as Sentry from '@sentry/node'

type TxActivityDAO = entity.TxActivity & {
  transaction: entity.TxTransaction
}

interface UpdatedIds {
  id: string
}

// only update to fulfilled or cancelled allowed
const updateStatusByIds = async (
  _: any,
  args: gql.MutationUpdateStatusByIdsArgs,
  ctx: Context,
): Promise<gql.UpdateReadOutput> => {
  const activities: gql.UpdateReadOutput = {
    updatedIdsSuccess: [],
    idsNotFoundOrFailed: [],
  }
  const { repositories, chain, wallet } = ctx
  const { ids, status } = args

  if (!ids.length) {
    return Promise.reject(
      appError.buildInvalid(txActivityError.buildNoActivityId(), txActivityError.ErrorType.ActivityNotSet),
    )
  }

  if (!Object.keys(defs.ActivityStatus).includes(status)) {
    return Promise.reject(
      appError.buildInvalid(txActivityError.buildIncorrectStatus(status), txActivityError.ErrorType.StatusNotAllowed),
    )
  }

  if (status === defs.ActivityStatus.Valid) {
    return Promise.reject(
      appError.buildInvalid(txActivityError.buildStatusNotAllowed(status), txActivityError.ErrorType.StatusNotAllowed),
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

  const ownedIds: string[] = ownedActivities.map((ownedActivity: entity.TxActivity) => ownedActivity.id)

  const filters: defs.ActivityFilters = {
    walletAddress,
    chainId: chain.id,
  }
  const updatedIds: UpdateResult = await repositories.txActivity.updateActivities(ownedIds, filters, 'status', status)
  activities.updatedIdsSuccess = updatedIds?.raw?.map((item: UpdatedIds) => item.id)
  activities.idsNotFoundOrFailed = ids.filter((id: string) => !activities.updatedIdsSuccess.includes(id))
  return activities
}

/**
 * Retrieves the OpenSea signatures for the provided order hashes and updates the
 * corresponding signature field in the database.
 *
 * @param _ - Ignored root object
 * @param args - Contains input parameters: orderHashes and chainId
 * @param ctx - Context object containing repositories and wallet
 * @returns A Promise resolving to an array of updated TxOrder entities
 */
const getSeaportSignatures = async (
  _: any,
  args: gql.QueryGetSeaportSignaturesArgs,
  ctx: Context,
): Promise<entity.TxOrder[]> => {
  try {
    const { repositories, wallet } = ctx
    const orderHashes = args.input.orderHashes
    const chainId = wallet.chainId || process.env.CHAIN_ID
    auth.verifyAndGetNetworkChain('ethereum', chainId)

    // Define the input validation schema
    const schema = Joi.object({
      input: Joi.object({
        orderHashes: Joi.array().items(Joi.string()).required(),
      }).required(),
    })

    joi.validateSchema(schema, args)

    // Check if the provided order hashes exist in the database
    const orders = await repositories.txOrder.findOrdersByHashes(orderHashes, chainId)

    if (orders.length !== orderHashes.length) {
      throw new Error('Some order hashes do not exist in the database.')
    }

    // Filter orders with existing signatures
    const ordersWithSignatures = orders.filter(order => order.protocolData.signature)

    const updatedOrders: entity.TxOrder[] = []

    // Add orders with existing signatures to updatedOrders
    updatedOrders.push(...ordersWithSignatures)

    // Filter orders without signatures and prepare their payloads
    const ordersWithoutSignatures = orders.filter(order => !order.protocolData.signature)

    // Prepare the payload for orders with null signatures
    const payloads: openseaService.ListingPayload[] = ordersWithoutSignatures.map(order => ({
      listing: {
        hash: order.orderHash,
        chain: chainId === '1' ? 'ethereum' : 'goerli',
        protocol_address: contracts.openseaSeaportAddress1_4(chainId),
      },
      fulfiller: {
        address: wallet.address,
      },
    }))

    const responses = payloads?.length ? await openseaService.postListingFulfillments(payloads, chainId) : []

    for (let i = 0; i < responses.length; i++) {
      const signature = responses[i].fulfillment_data.transaction.input_data.parameters.signature

      const updateResult: entity.TxOrder = await repositories.txOrder.updateOneById(orders[i].id, {
        protocolData: {
          ...orders[i].protocolData,
          signature,
        },
      })

      updatedOrders.push(updateResult)
    }

    return updatedOrders
  } catch (e) {
    throw new Error(e)
  }
}

const updateReadByIds = async (
  _: any,
  args: gql.MutationUpdateReadByIdsArgs,
  ctx: Context,
): Promise<gql.UpdateReadOutput> => {
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
    if (ids.length) {
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

  const ownedIds: string[] = ownedActivities.length
    ? ownedActivities.map((ownedActivity: entity.TxActivity) => ownedActivity.id)
    : []

  const filters: defs.ActivityFilters = {
    walletAddress,
    chainId: chain.id,
  }
  const updatedIds: UpdateResult = await repositories.txActivity.updateActivities(ownedIds, filters, 'read', true)
  activities.updatedIdsSuccess = updatedIds?.raw?.map((item: UpdatedIds) => item.id)
  activities.idsNotFoundOrFailed = ids.filter((id: string) => !activities.updatedIdsSuccess.includes(id))
  return activities
}

const getActivitiesByType = (
  _: any,
  args: gql.QueryGetActivitiesByTypeArgs,
  ctx: Context,
): Promise<entity.TxActivity[]> => {
  const { repositories } = ctx
  const activityType = defs.ActivityType[args.activityType]
  const chainId = args?.chainId || process.env.CHAIN_ID
  auth.verifyAndGetNetworkChain('ethereum', chainId)
  return repositories.txActivity.findActivitiesByType(activityType, chainId)
}

const getActivitiesByWalletAddress = (
  _: any,
  args: gql.QueryGetActivitiesByWalletAddressArgs,
  ctx: Context,
): Promise<entity.TxActivity[]> => {
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

  return repositories.txActivity.findActivitiesByWalletAddressAndType(walletAddress, activityType, chainId)
}

const getActivities = async (_: any, args: gql.QueryGetActivitiesArgs, ctx: Context): Promise<any> => {
  const { repositories, network } = ctx

  const schema = Joi.object().keys({
    input: Joi.object()
      .required()
      .keys({
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

  const { pageInput, walletAddress, activityType, status, read, tokenId, contract, skipRelations, expirationType } =
    helper.safeObject(args.input)

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

  const chainId: string = args.input?.chainId || process.env.CHAIN_ID
  const verificationNetwork: string = network || 'ethereum'
  let checksumContract: string

  auth.verifyAndGetNetworkChain(verificationNetwork, chainId)

  let filters: defs.ActivityFilters = { chainId, status: defs.ActivityStatus.Valid }

  if (walletAddress) {
    const walletAddressVerifed: string = helper.checkSum(walletAddress)
    filters = { ...filters, walletAddress: walletAddressVerifed }
  }

  if (activityType) {
    const castedActivityType: defs.ActivityType = activityType as defs.ActivityType
    if (!Object.values(defs.ActivityType).includes(castedActivityType)) {
      return Promise.reject(
        appError.buildInvalid(
          txActivityError.buildIncorrectActivity(castedActivityType),
          txActivityError.ErrorType.ActivityIncorrect,
        ),
      )
    }
    filters = {
      ...filters,
      activityType:
        castedActivityType == defs.ActivityType.Purchase
          ? defs.ActivityType.Sale // force purchase to be sale to not break tx query
          : castedActivityType,
    }
  }

  if (status && status !== defs.ActivityStatus.Valid) {
    const castedStatus: defs.ActivityStatus = status
    if (!Object.values(defs.ActivityStatus).includes(castedStatus)) {
      return Promise.reject(
        appError.buildInvalid(
          txActivityError.buildIncorrectStatus(castedStatus),
          txActivityError.ErrorType.StatusIncorrect,
        ),
      )
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
    return Promise.reject(
      appError.buildInvalid(txActivityError.buildTokenWithNoContract(), txActivityError.ErrorType.TokenWithNoContract),
    )
  }
  if (contract && tokenId) {
    nftId = `ethereum/${checksumContract}/${BigNumber.from(tokenId).toHexString()}`
  }

  if (nftId?.length) {
    filters = { ...filters, nftId }
  }

  // by default expired items are included
  if (!expirationType || expirationType === gql.ActivityExpiration.Active) {
    filters = { ...filters, expiration: helper.moreThanDate(new Date().toString()) }
  } else if (expirationType === gql.ActivityExpiration.Expired) {
    filters = { ...filters, expiration: helper.lessThanDate(new Date().toString()) }
  }

  let safefilters
  if (read !== undefined) {
    safefilters = [{ ...helper.inputT2SafeK(filters), read }]
  } else {
    safefilters = [helper.inputT2SafeK(filters)]
  }

  if (skipRelations) {
    return core
      .paginatedEntitiesBy(repositories.txActivity, pageInput, safefilters, [], 'createdAt', 'DESC')
      .then(pagination.toPageable(pageInput, null, null, 'createdAt'))
  }

  const cacheKey = `${CacheKeys.GET_ACTIVITIES}_${activityType}_${JSON.stringify(safefilters)}`
  let indexedActivities: gql.TxActivity[] = []
  const cachedData = await cache.get(cacheKey)
  if (cachedData) {
    indexedActivities = JSON.parse(cachedData) as gql.TxActivity[]
  } else {
    // query activities
    const orderBy = <defs.OrderBy>{ ['activity.updatedAt']: 'DESC' }
    const activities = await repositories.txActivity.findActivities({
      filters: safefilters,
      orderBy,
      relations: [],
      take: 0,
    })
    let filteredActivities: gql.TxActivity[] = activities[0] as gql.TxActivity[]

    // find transaction activities for wallet address as recipient
    let asRecipientTxs: entity.TxTransaction[] = []
    if (
      safefilters[0].walletAddress &&
      (!safefilters[0].activityType ||
        (activityType as defs.ActivityType) === gql.ActivityType.Purchase ||
        safefilters[0].activityType === ActivityType.Transfer ||
        safefilters[0].activityType === ActivityType.Swap)
    ) {
      asRecipientTxs = await repositories.txTransaction.findRecipientTxs(
        safefilters[0].activityType,
        safefilters[0].walletAddress,
        ActivityStatus.Valid,
      )
    }

    asRecipientTxs.map(tx => {
      const activity = tx.activity as gql.TxActivity
      activity.activityType = gql.ActivityType.Purchase
      filteredActivities.push(activity)
    })

    if (activityType == ActivityType.Sale) {
      filteredActivities = filteredActivities.filter(activity => activity.activityType == ActivityType.Sale)
    } else if (activityType == gql.ActivityType.Purchase) {
      filteredActivities = filteredActivities.filter(activity => activity.activityType == gql.ActivityType.Purchase)
    }

    // sort and return
    const sortedActivities = _lodash.orderBy(filteredActivities, ['updatedAt'], ['desc'])
    let index = 0
    sortedActivities.map(activity => {
      indexedActivities.push({
        index,
        ...activity as gql.TxActivity,
      })
      index++
    })
    await cache.set(
      cacheKey,
      JSON.stringify(indexedActivities),
      'EX',
      3 * 60, // 3 min
    )
  }
  return paginatedResultFromIndexedArray(indexedActivities, pageInput)
}

const fulfillActivitiesNFTId = async (
  _: any,
  args: gql.MutationFulfillActivitiesNFTIdArgs,
  ctx: Context,
): Promise<gql.FulfillActivitiesNFTIdOutput> => {
  const { repositories } = ctx
  try {
    const count = Math.min(Number(args?.count), 1000)
    const activities = await repositories.txActivity.findActivitiesWithEmptyNFT(defs.ActivityType.Sale)
    const slicedActivities = activities.slice(0, count)
    await Promise.allSettled(
      slicedActivities.map(async activity => {
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
    getActivitiesByWalletAddress: combineResolvers(auth.isAuthenticated, getActivitiesByWalletAddress),
    getActivitiesByWalletAddressAndType: combineResolvers(auth.isAuthenticated, getActivitiesByWalletAddressAndType),
    getSeaportSignatures: combineResolvers(auth.isAuthenticated, getSeaportSignatures),
  },
  Mutation: {
    updateReadByIds: combineResolvers(auth.isAuthenticated, updateReadByIds),
    updateStatusByIds: combineResolvers(auth.isAuthenticated, updateStatusByIds),
    fulfillActivitiesNFTId: combineResolvers(auth.isAuthenticated, fulfillActivitiesNFTId),
  },
  ProtocolData: {
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
  TxProtocolData: {
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
