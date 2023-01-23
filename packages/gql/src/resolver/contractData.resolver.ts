import { ethers } from 'ethers'
import Joi from 'joi'

import { cache, CacheKeys } from '@nftcom/cache'
import { getContractSales } from '@nftcom/contract-data'
import { Context, gql } from '@nftcom/gql/defs'
import { joi } from '@nftcom/gql/helper'
import { paginatedResultFromIndexedArray } from '@nftcom/gql/service/core.service'
import { fetchData } from '@nftcom/nftport-client'
import { _logger, defs, entity } from '@nftcom/shared'
import * as Sentry from '@sentry/node'

const logger = _logger.Factory(_logger.Context.Misc, _logger.Context.GraphQL)

type TxActivityDAO = entity.TxActivity & { order: entity.TxOrder }

export const getNFTDetails = async (
  _: any,
  args: gql.QueryGetNFTDetailsArgs,
  _ctx: Context,
): Promise<gql.NFTDetail> => {
  const schema = Joi.object().keys({
    contractAddress: Joi.string().required(),
    tokenId: Joi.string().required(),
    refreshMetadata: Joi.boolean().optional(),
  })
  joi.validateSchema(schema, args.input)
  const { contractAddress, tokenId, refreshMetadata } = args.input

  return await fetchData('nfts', [contractAddress, tokenId], {
    queryParams: { refresh_metadata: !!refreshMetadata },
  })
}

export const getContractSalesStatistics = async (
  _: any,
  args: gql.QueryGetContractSalesStatisticsArgs,
  _ctx: Context,
): Promise<gql.ContractSalesStatistics> => {
  const schema = Joi.object().keys({
    contractAddress: Joi.string().required(),
  })
  joi.validateSchema(schema, args.input)
  const { contractAddress } = args.input

  return await fetchData('stats', [contractAddress])
}

const fetchTxsFromNFTPort = async (
  endpoint: string,
  chain: string,
  type: string[],
  contractAddress: string,
  tokenId?: string,
): Promise<any[]> => {
  try {
    const nftPortResult = []
    let args, cacheKey
    if (tokenId) {
      cacheKey = `NFTPORT_${endpoint}_${chain}_${JSON.stringify(type)}_${contractAddress}_${tokenId}`
      args = [contractAddress, tokenId]
    } else {
      cacheKey = `NFTPORT_${endpoint}_${chain}_${JSON.stringify(type)}_${contractAddress}`
      args = [contractAddress]
    }
    const cachedData = await cache.get(cacheKey)
    if (cachedData) {
      return JSON.parse(cachedData)
    }
    // fetch txs from NFTPort client we built
    let res = await fetchData(endpoint, args, {
      queryParams: {
        chain,
        type: type,
        page_size: 50,
      },
    })
    if (res?.data?.transactions) {
      nftPortResult.push(res?.data?.transactions)
      if (res?.data?.continuation) {
        let continuation = res?.data?.continuation
        // eslint-disable-next-line no-constant-condition
        while (true) {
          res = await fetchData(endpoint, args, {
            queryParams: {
              chain,
              type: type,
              continuation,
              page_size: 50,
            },
          })
          if (res?.data?.transactions) {
            nftPortResult.push(res?.data?.transactions)
            if (res?.data?.continuation) {
              continuation = res?.data?.continuation
            } else {
              break
            }
          } else {
            break
          }
        }
      }
      await cache.set(cacheKey, JSON.stringify(nftPortResult), 'EX', 60 * 10) // 10 min
      return nftPortResult
    } else {
      return []
    }
  } catch (err) {
    logger.error(`Error in fetchTxsFromNFTPort: ${err}`)
    Sentry.captureMessage(`Error in fetchTxsFromNFTPort: ${err}`)
    throw err
  }
}

const parseTypesToActivityTypes = (
  types: string[],
): defs.ActivityType[] => {
  const activityTypes = []
  if (types.findIndex((type) => type === 'all') !== -1) {
    activityTypes.push(defs.ActivityType.Listing)
    activityTypes.push(defs.ActivityType.Bid)
    activityTypes.push(defs.ActivityType.Cancel)
    activityTypes.push(defs.ActivityType.Sale)
    activityTypes.push(defs.ActivityType.Transfer)
    activityTypes.push(defs.ActivityType.Swap)
    return activityTypes
  }
  const isExisting = {}
  for (const type of types) {
    if (type === 'listing' && !isExisting[type]) {
      activityTypes.push(defs.ActivityType.Listing)
      isExisting[type] = true
    }
    else if (type === 'bid' && !isExisting[type]) {
      activityTypes.push(defs.ActivityType.Bid)
      isExisting[type] = true
    }
    else if (type === 'cancel' && !isExisting[type]) {
      activityTypes.push(defs.ActivityType.Cancel)
      isExisting[type] = true
    }
    else if (type === 'swap' && !isExisting[type]) {
      activityTypes.push(defs.ActivityType.Swap)
      isExisting[type] = true
    }
    else if (type === 'transfer' && !isExisting[type]) {
      activityTypes.push(defs.ActivityType.Transfer)
      isExisting[type] = true
    }
  }
  return activityTypes
}

export const getTxByContract = async (
  _: any,
  args: gql.QueryGetTxByContractArgs,
  _ctx: Context,
): Promise<gql.GetTxByContract> => {
  const { repositories } = _ctx
  const schema = Joi.object().keys({
    contractAddress: Joi.string().required(),
    chain: Joi.string().valid('ethereum').optional(),
    type: Joi.array().items(Joi.string().valid('listing', 'bid', 'cancel', 'swap', 'transfer', 'burn', 'mint', 'sale', 'all')).optional(),
    pageInput: Joi.any().optional(),
  })
  joi.validateSchema(schema, args.input)
  const { contractAddress, chain, type, pageInput } = args.input
  const cacheKey = `${CacheKeys.GET_TX_BY_CONTRACT}_${ethers.utils.getAddress(contractAddress)}`
  const cachedData = await cache.get(cacheKey)
  let txActivities: Array<gql.NFTPortTxByContractTransactions> = []

  if (cachedData) {
    txActivities = JSON.parse(cachedData)
  } else {
    const nftPortResult = await fetchTxsFromNFTPort('txByContract', chain || 'ethereum', type || ['all'], contractAddress)
    const activityTypes = parseTypesToActivityTypes(type || ['all'])
    const activities = await repositories.txActivity.findActivitiesForCollection(
      ethers.utils.getAddress(contractAddress),
      activityTypes,
    )
    // 1. return activities from tx_activity table
    for (let i = 0; i < activities.length; i++) {
      const activityDAO = activities[i] as TxActivityDAO
      let activity: gql.NFTPortTxByContractTransactions = {
        index: i,
        type: activityDAO.activityType.toLowerCase(),
        owner_address: activityDAO.order.makerAddress,
        contract_address: ethers.utils.getAddress(contractAddress),
        protocolData: activityDAO.order.protocolData,
        marketplace: activityDAO.order.protocol,
      }
      if (activityDAO.order.orderType === 'Listing') {
        activity = {
          ...activity,
          seller_address: activityDAO.order.makerAddress,
        }
      } else if (activityDAO.order.orderType === 'Bid') {
        activity = {
          ...activity,
          buyer_address: activityDAO.order.makerAddress,
        }
      }
      txActivities.push(activity)
    }
    // 2. return NFTPort result
    let index = txActivities.length
    nftPortResult.map((tx) => {
      txActivities.push({
        index,
        ...tx,
      })
      index++
    })
    await cache.set(
      cacheKey,
      JSON.stringify(txActivities),
      'EX',
      10 * 60, // 10 min
    )
  }

  return paginatedResultFromIndexedArray(txActivities, pageInput)
}

export const getTxByNFT = async (
  _: any,
  args: gql.QueryGetTxByNFTArgs,
  _ctx: Context,
): Promise<gql.GetTxByNFT> => {
  const { repositories } = _ctx
  const schema = Joi.object().keys({
    contractAddress: Joi.string().required(),
    tokenId: Joi.string().required(),
    chain: Joi.string().valid('ethereum').optional(),
    type: Joi.array().items(Joi.string().valid('listing', 'bid', 'cancel', 'swap', 'transfer', 'burn', 'mint', 'sale', 'all')).optional(),
    pageInput: Joi.any().optional(),
  })
  joi.validateSchema(schema, args.input)
  const { contractAddress, tokenId, chain, type, pageInput } = args.input
  const cacheKey = `${CacheKeys.GET_TX_BY_NFT}_${ethers.utils.getAddress(contractAddress)}_${tokenId}`
  const cachedData = await cache.get(cacheKey)
  let txActivities: Array<gql.NFTPortTxByNftTransactions> = []

  if (cachedData) {
    txActivities = JSON.parse(cachedData)
  } else {
    const nftPortResult = await fetchTxsFromNFTPort('txByNFT', chain || 'ethereum', type || ['all'], contractAddress, tokenId)
    const activityTypes = parseTypesToActivityTypes(type || ['all'])
    const activities = await repositories.txActivity.findActivitiesForNFT(
      ethers.utils.getAddress(contractAddress),
      tokenId,
      activityTypes,
    )
    // 1. return activities from tx_activity table
    for (let i = 0; i < activities.length; i++) {
      const activityDAO = activities[i] as TxActivityDAO
      let activity: gql.NFTPortTxByNftTransactions = {
        index: i,
        type: activityDAO.activityType.toLowerCase(),
        owner_address: activityDAO.order.makerAddress,
        contract_address: ethers.utils.getAddress(contractAddress),
        protocolData: activityDAO.order.protocolData,
        marketplace: activityDAO.order.protocol,
        nft: {
          contract_address: contractAddress,
          token_id: tokenId,
        },
      }
      if (activityDAO.order.orderType === 'Listing') {
        activity = {
          ...activity,
          seller_address: activityDAO.order.makerAddress,
        }
      } else if (activityDAO.order.orderType === 'Bid') {
        activity = {
          ...activity,
          buyer_address: activityDAO.order.makerAddress,
        }
      }
      txActivities.push(activity)
    }
    // 2. return NFTPort result
    let index = txActivities.length
    nftPortResult.map((tx) => {
      txActivities.push({
        index,
        ...tx,
      })
      index++
    })
    await cache.set(
      cacheKey,
      JSON.stringify(txActivities),
      'EX',
      10 * 60, // 10 min
    )
  }

  return paginatedResultFromIndexedArray(txActivities, pageInput)
}

export const getSales = async (_: any, args: gql.QueryGetSalesArgs, _ctx: any): Promise<any> => {
  const schema = Joi.object().keys({
    contractAddress: Joi.string().required(),
    dateRange: Joi.string().valid('24h', '7d', '30d', '90d', '6m', '1y', 'all').optional(),
    tokenId: Joi.string().optional(),
  })
  joi.validateSchema(schema, args.input)
  const { contractAddress, dateRange, tokenId } = args.input

  return await getContractSales(contractAddress, dateRange, tokenId)
}

export default {
  Query: {
    getNFTDetails,
    getContractSalesStatistics,
    getTxByContract,
    getTxByNFT,
    getSales,
  },
}
