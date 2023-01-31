import { BigNumber as BN } from 'bignumber.js'
import { BigNumber, ethers } from 'ethers'
import { defaultAbiCoder } from 'ethers/lib/utils'
import Joi from 'joi'
import * as _lodash from 'lodash'

import { cache, CacheKeys } from '@nftcom/cache'
import { getContractSales } from '@nftcom/contract-data'
import { Context, gql } from '@nftcom/gql/defs'
import { coins,joi } from '@nftcom/gql/helper'
import { paginatedResultFromIndexedArray } from '@nftcom/gql/service/core.service'
import { fetchData } from '@nftcom/nftport-client'
import { _logger, defs, entity } from '@nftcom/shared'

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
): number => {
  return assets.findIndex((asset) =>
    asset.standard.contractAddress === ethers.utils.getAddress(contractAddress) &&
    asset.standard.tokenId === BigNumber.from(tokenId).toHexString(),
  )
}

const parsePriceDetailFromAsset = (
  asset: defs.MarketplaceAsset,
): gql.NFTPortTxByNftPriceDetails => {
  const res = defaultAbiCoder.decode(['uint256','uint256'], asset.bytes)
  const value = BigNumber.from(res[0]).toHexString()
  logger.info(`hex value: ${value}`)
  const coin = coins.basicCoins.find((coin) =>
    coin.address === ethers.utils.getAddress(asset.standard.contractAddress),
  )
  let decimals
  if (coin) {
    decimals = coin.decimals
  } else {
    decimals = 18
  }

  logger.info(`decimals: ${decimals}`)
  return {
    assetType: asset.standard.assetClass,
    contractAddress: asset.standard.contractAddress,
    price: new BN(value).shiftedBy(-decimals).toFixed(),
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
    const chainId = chain === 'ethereum' ? '1' : '137'
    let txActivities: Array<gql.NFTPortTxByContractTransactions> = []
    const nftPortTxs = await repositories.nftPortTransaction.findTransactionsByCollection(contractAddress, chainId)
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
        contractAddress: ethers.utils.getAddress(contractAddress),
        transactionDate: activityDAO.timestamp,
      }
      if (activityDAO.activityType === 'Listing') {
        activity = {
          ...activity,
          ownerAddress: activityDAO.order.makerAddress,
          sellerAddress: activityDAO.order.makerAddress,
          protocolData: activityDAO.order.protocolData,
          marketplace: activityDAO.order.protocol,
        }
        let priceDetails = undefined
        activityDAO.order.protocolData.makeAsset.map((asset, index) => {
          if (asset.standard.contractAddress === ethers.utils.getAddress(contractAddress)) {
            priceDetails = parsePriceDetailFromAsset(activityDAO.order.protocolData.takeAsset[index])
            activity = {
              ...activity,
              priceDetails,
            }
            txActivities.push(activity)
          }
        })
        if (!priceDetails) {
          priceDetails = {
            assetType: null,
            contractAddress: null,
            price: null,
          }
          activity = {
            ...activity,
            priceDetails,
          }
          txActivities.push(activity)
        }
      } else if (activityDAO.activityType === 'Bid') {
        activity = {
          ...activity,
          ownerAddress: activityDAO.order.makerAddress,
          buyerAddress: activityDAO.order.makerAddress,
          protocolData: activityDAO.order.protocolData,
          marketplace: activityDAO.order.protocol,
        }
        let priceDetails = undefined
        activityDAO.order.protocolData.takeAsset.map((asset, index) => {
          if (asset.standard.contractAddress === ethers.utils.getAddress(contractAddress)) {
            priceDetails = parsePriceDetailFromAsset(activityDAO.order.protocolData.makeAsset[index])
            activity = {
              ...activity,
              priceDetails,
            }
            txActivities.push(activity)
          }
        })
        if (!priceDetails) {
          priceDetails = {
            assetType: null,
            contractAddress: null,
            price: null,
          }
          activity = {
            ...activity,
            priceDetails,
          }
          txActivities.push(activity)
        }
      } else if (activityDAO.activityType === 'Cancel') {
        activity = {
          ...activity,
          transactionHash: activityDAO.cancel.transactionHash,
          marketplace: activityDAO.cancel.exchange,
        }
        txActivities.push(activity)
      } else if (activityDAO.activityType === 'Swap') {
        activity = {
          ...activity,
          transactionHash: activityDAO.transaction.transactionHash,
          protocolData: activityDAO.transaction.protocolData,
          marketplace: activityDAO.transaction.protocol,
        }
        txActivities.push(activity)
      }
    }
    // 2. return NFTPort result
    txActivities.push(...nftPortTxs)

    // 3. sort result
    let index = 0
    txActivities = _lodash.orderBy(txActivities, ['transactionDate'], ['desc'])
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
    const chainId = chain === 'ethereum' ? '1' : '137'
    let txActivities: Array<gql.NFTPortTxByNftTransactions> = []
    const nftPortTxs = await repositories.nftPortTransaction.findTransactionsByNFT(contractAddress, tokenId, chainId)
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
        contractAddress: ethers.utils.getAddress(contractAddress),
        nft: {
          contractAddress: contractAddress,
          tokenId: BigNumber.from(tokenId).toHexString(),
        },
        transactionDate: activityDAO.timestamp,
      }
      if (activityDAO.activityType === 'Listing') {
        let priceDetails
        const index = findNFTFromAssets(activityDAO.order.protocolData.makeAsset, contractAddress, tokenId)
        if (index !== -1) {
          priceDetails = parsePriceDetailFromAsset(activityDAO.order.protocolData.takeAsset[index])
        } else {
          priceDetails = {
            assetType: null,
            contractAddress: null,
            price: null,
          }
        }
        activity = {
          ...activity,
          ownerAddress: activityDAO.order.makerAddress,
          sellerAddress: activityDAO.order.makerAddress,
          protocolData: activityDAO.order.protocolData,
          marketplace: activityDAO.order.protocol,
          priceDetails,
        }
      } else if (activityDAO.activityType === 'Bid') {
        let priceDetails
        const index = findNFTFromAssets(activityDAO.order.protocolData.takeAsset, contractAddress, tokenId)
        if (index !== -1) {
          priceDetails = parsePriceDetailFromAsset(activityDAO.order.protocolData.makeAsset[index])
        } else {
          priceDetails = {
            assetType: null,
            contractAddress: null,
            price: null,
          }
        }
        activity = {
          ...activity,
          ownerAddress: activityDAO.order.makerAddress,
          buyerAddress: activityDAO.order.makerAddress,
          protocolData: activityDAO.order.protocolData,
          marketplace: activityDAO.order.protocol,
          priceDetails,
        }
      } else if (activityDAO.activityType === 'Cancel') {
        activity = {
          ...activity,
          transactionHash: activityDAO.cancel.transactionHash,
          marketplace: activityDAO.cancel.exchange,
        }
      } else if (activityDAO.activityType === 'Swap') {
        activity = {
          ...activity,
          transactionHash: activityDAO.transaction.transactionHash,
          protocolData: activityDAO.transaction.protocolData,
          marketplace: activityDAO.transaction.protocol,
        }
      }
      txActivities.push(activity)
    }
    // 2. return NFTPort result
    txActivities.push(...nftPortTxs)

    // 3. sort result
    let index = 0
    txActivities = _lodash.orderBy(txActivities, ['transactionDate'], ['desc'])
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
