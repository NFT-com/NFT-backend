import { BigNumber, ethers } from 'ethers'
import { defaultAbiCoder } from 'ethers/lib/utils'
import Joi from 'joi'
import * as _lodash from 'lodash'

import { cache, CacheKeys } from '@nftcom/cache'
import { getContractSales } from '@nftcom/contract-data'
import { Context, gql } from '@nftcom/gql/defs'
import { joi } from '@nftcom/gql/helper'
import { paginatedResultFromIndexedArray } from '@nftcom/gql/service/core.service'
import { fetchData } from '@nftcom/nftport-client'
import { _logger, defs, entity } from '@nftcom/shared'
import * as Sentry from '@sentry/node'

const logger = _logger.Factory(_logger.Context.ContractData, _logger.Context.GraphQL)

type TxActivityDAO = entity.TxActivity & {
  order: entity.TxOrder
  transaction: entity.TxTransaction
  cancel: entity.TxCancel
}

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

const findNFTFromAssets = (
  assets: defs.MarketplaceAsset[],
  contractAddress: string,
  tokenId: string,
): defs.MarketplaceAsset => {
  return assets.find((asset) =>
    asset.standard.contractAddress === ethers.utils.getAddress(contractAddress) &&
    asset.standard.tokenId === BigNumber.from(tokenId).toHexString(),
  )
}

const parsePriceDetailFromAsset = (
  asset?: defs.MarketplaceAsset,
): gql.NFTPortTxByNftPriceDetails => {
  if (!asset) {
    return {
      asset_type: null,
      contract_address: null,
      price: null,
    }
  }
  const res = defaultAbiCoder.decode(['uint256','uint256'], asset.bytes)
  const value = BigNumber.from(res[0])
  return {
    asset_type: asset.standard.assetClass,
    contract_address: asset.standard.contractAddress,
    price: value.toNumber(),
  }
}

const fetchTxsFromNFTPort = async (
  endpoint: string,
  chain: string,
  type: string[],
  contractAddress: string,
  tokenId?: string,
): Promise<any[]> => {
  try {
    const availableTypes = ['transfer', 'burn', 'mint', 'sale', 'list', 'all']
    const filteredType = type.filter((t) => availableTypes.indexOf(t) !== -1)
    const nftPortResult = []
    let args, cacheKey
    if (tokenId) {
      cacheKey = `NFTPORT_${endpoint}_${chain}_${JSON.stringify(filteredType)}_${contractAddress}_${BigNumber.from(tokenId).toHexString()}`
      args = [contractAddress, BigNumber.from(tokenId).toString()]
    } else {
      cacheKey = `NFTPORT_${endpoint}_${chain}_${JSON.stringify(filteredType)}_${contractAddress}`
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
        cacheSeconds: 60 * 10,
      },
    })
    if (res?.transactions) {
      nftPortResult.push(...res.transactions)
      if (res?.continuation) {
        let continuation = res?.continuation
        // eslint-disable-next-line no-constant-condition
        while (true) {
          res = await fetchData(endpoint, args, {
            queryParams: {
              chain,
              type: type,
              continuation,
              page_size: 50,
              cacheSeconds: 60 * 10,
            },
          })
          if (res?.transactions) {
            nftPortResult.push(...res.transactions)
            if (res?.continuation) {
              continuation = res?.continuation
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
    return []
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
    type: Joi.array().items(Joi.string().valid('listing', 'bid', 'cancel', 'swap', 'transfer', 'burn', 'mint', 'sale', 'list', 'all')).optional(),
    pageInput: Joi.any().optional(),
  })
  joi.validateSchema(schema, args.input)
  const { contractAddress, chain, type, pageInput } = args.input
  const cacheKey = `${CacheKeys.GET_TX_BY_CONTRACT}_${ethers.utils.getAddress(contractAddress)}`
  const cachedData = await cache.get(cacheKey)
  let indexedActivities: Array<gql.NFTPortTxByContractTransactions> = []

  if (cachedData) {
    indexedActivities = JSON.parse(cachedData)
  } else {
    let txActivities: Array<gql.NFTPortTxByContractTransactions> = []
    const nftPortResult = await fetchTxsFromNFTPort('txByContract', chain || 'ethereum', type || ['all'], contractAddress)
    const activityTypes = parseTypesToActivityTypes(type || ['all'])
    let activities = await repositories.txActivity.findActivitiesForCollection(
      ethers.utils.getAddress(contractAddress),
      activityTypes,
      defs.ProtocolType.NFTCOM,
    )
    activities = activities.filter((activity) => {
      const activityDAO = activity as TxActivityDAO
      return !!(activityDAO.order || activityDAO.transaction || activityDAO.cancel)
    })
    // 1. return activities from tx_activity table
    for (let i = 0; i < activities.length; i++) {
      const activityDAO = activities[i] as TxActivityDAO
      let activity: gql.NFTPortTxByContractTransactions = {
        type: activityDAO.activityType.toLowerCase(),
        contract_address: ethers.utils.getAddress(contractAddress),
        timestamp: activityDAO.timestamp,
        transaction_date: activityDAO.timestamp.toString(),
      }
      if (activityDAO.activityType === 'Listing') {
        activity = {
          ...activity,
          owner_address: activityDAO.order.makerAddress,
          seller_address: activityDAO.order.makerAddress,
          protocolData: activityDAO.order.protocolData,
          marketplace: activityDAO.order.protocol,
        }
      } else if (activityDAO.activityType === 'Bid') {
        activity = {
          ...activity,
          owner_address: activityDAO.order.makerAddress,
          buyer_address: activityDAO.order.makerAddress,
          protocolData: activityDAO.order.protocolData,
          marketplace: activityDAO.order.protocol,
        }
      } else if (activityDAO.activityType === 'Cancel') {
        activity = {
          ...activity,
          transaction_hash: activityDAO.cancel.transactionHash,
          marketplace: activityDAO.cancel.exchange,
        }
      } else if (activityDAO.activityType === 'Swap') {
        activity = {
          ...activity,
          transaction_hash: activityDAO.transaction.transactionHash,
          protocolData: activityDAO.transaction.protocolData,
          marketplace: activityDAO.transaction.protocol,
        }
      }
      txActivities.push(activity)
    }
    // 2. return NFTPort result
    nftPortResult.map((tx) => {
      txActivities.push({
        timestamp: new Date(tx.transaction_date),
        ...tx,
      })
    })

    // 3. sort result
    let index = 0
    txActivities = _lodash.orderBy(txActivities, ['timestamp'], ['desc'])
    txActivities.map((activity) => {
      indexedActivities.push({
        index,
        ...activity,
      })
      index++
    })
    await cache.set(
      cacheKey,
      JSON.stringify(indexedActivities),
      'EX',
      10 * 60, // 10 min
    )
  }

  return paginatedResultFromIndexedArray(indexedActivities, pageInput)
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
    type: Joi.array().items(Joi.string().valid('listing', 'bid', 'cancel', 'swap', 'transfer', 'burn', 'mint', 'sale', 'list', 'all')).optional(),
    pageInput: Joi.any().optional(),
  })

  joi.validateSchema(schema, args.input)
  const { contractAddress, tokenId, chain, type, pageInput } = args.input
  const cacheKey = `${CacheKeys.GET_TX_BY_NFT}_${ethers.utils.getAddress(contractAddress)}_${BigNumber.from(tokenId).toHexString()}`
  const cachedData = await cache.get(cacheKey)
  let indexedActivities: Array<gql.NFTPortTxByNftTransactions> = []

  if (cachedData) {
    indexedActivities = JSON.parse(cachedData)
  } else {
    let txActivities: Array<gql.NFTPortTxByNftTransactions> = []
    const nftPortResult = await fetchTxsFromNFTPort('txByNFT', chain || 'ethereum', type || ['all'], contractAddress, tokenId)
    const activityTypes = parseTypesToActivityTypes(type || ['all'])
    let activities = await repositories.txActivity.findActivitiesForNFT(
      ethers.utils.getAddress(contractAddress),
      BigNumber.from(tokenId).toHexString(),
      activityTypes,
      defs.ProtocolType.NFTCOM,
    )

    activities = activities.filter((activity) => {
      const activityDAO = activity as TxActivityDAO
      return !!(activityDAO.order || activityDAO.transaction || activityDAO.cancel)
    })

    // 1. return activities from tx_activity table
    for (let i = 0; i < activities.length; i++) {
      const activityDAO = activities[i] as TxActivityDAO
      let activity: gql.NFTPortTxByNftTransactions = {
        type: activityDAO.activityType.toLowerCase(),
        contract_address: ethers.utils.getAddress(contractAddress),
        nft: {
          contract_address: contractAddress,
          token_id: BigNumber.from(tokenId).toHexString(),
        },
        transaction_date: activityDAO.timestamp.toString(),
        timestamp: activityDAO.timestamp,
      }
      if (activityDAO.activityType === 'Listing') {
        const price_details = parsePriceDetailFromAsset(
          findNFTFromAssets(activityDAO.order.protocolData.takeAsset, contractAddress, tokenId),
        )
        activity = {
          ...activity,
          owner_address: activityDAO.order.makerAddress,
          seller_address: activityDAO.order.makerAddress,
          protocolData: activityDAO.order.protocolData,
          marketplace: activityDAO.order.protocol,
          price_details,
        }
      } else if (activityDAO.activityType === 'Bid') {
        const price_details = parsePriceDetailFromAsset(
          findNFTFromAssets(activityDAO.order.protocolData.makeAsset, contractAddress, tokenId),
        )
        activity = {
          ...activity,
          owner_address: activityDAO.order.makerAddress,
          buyer_address: activityDAO.order.makerAddress,
          protocolData: activityDAO.order.protocolData,
          marketplace: activityDAO.order.protocol,
          price_details,
        }
      } else if (activityDAO.activityType === 'Cancel') {
        activity = {
          ...activity,
          transaction_hash: activityDAO.cancel.transactionHash,
          marketplace: activityDAO.cancel.exchange,
        }
      } else if (activityDAO.activityType === 'Swap') {
        activity = {
          ...activity,
          transaction_hash: activityDAO.transaction.transactionHash,
          protocolData: activityDAO.transaction.protocolData,
          marketplace: activityDAO.transaction.protocol,
        }
      }
      txActivities.push(activity)
    }
    // 2. return NFTPort result
    nftPortResult.map((tx) => {
      txActivities.push({
        timestamp: new Date(tx.transaction_date),
        ...tx,
      })
    })

    // 3. sort result
    let index = 0
    txActivities = _lodash.orderBy(txActivities, ['timestamp'], ['desc'])
    txActivities.map((activity) => {
      indexedActivities.push({
        index,
        ...activity,
      })
      index++
    })
    await cache.set(
      cacheKey,
      JSON.stringify(indexedActivities),
      'EX',
      10 * 60, // 10 min
    )
  }

  return paginatedResultFromIndexedArray(indexedActivities, pageInput)
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
