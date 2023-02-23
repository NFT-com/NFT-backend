import axios from 'axios'
import { BigNumber as BN } from 'bignumber.js'
import { BigNumber, ethers } from 'ethers'
import { defaultAbiCoder } from 'ethers/lib/utils'
import Joi from 'joi'
import * as _lodash from 'lodash'

import { cache, CacheKeys } from '@nftcom/cache'
import { getContractSales } from '@nftcom/contract-data'
import { Context, gql } from '@nftcom/gql/defs'
import { coins,joi } from '@nftcom/gql/helper'
import { getSymbolInUsd, paginatedResultFromIndexedArray } from '@nftcom/gql/service/core.service'
import { fetchData } from '@nftcom/nftport-client'
import { _logger, defs, entity } from '@nftcom/shared'
import * as Sentry from '@sentry/node'

const logger = _logger.Factory(_logger.Context.ContractData, _logger.Context.GraphQL)

// TODO: Authorization header for streams rest api should be updated
const AUTH_HEADER = '0xeaa4dddada518825a9451b7a0c7f2482119b8602def91287c5e6447a481131bc41747c116e2d7a463d78849773287c7d575104f1b24e90b86e4b6b88cf1714641b'

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

const parsePriceDetailFromAsset = async (
  asset: defs.MarketplaceAsset,
): Promise<gql.NFTPortTxByNftPriceDetails> => {
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

  const currentETHPrice = await getSymbolInUsd('ETH')

  logger.info(`decimals: ${decimals}`)
  const price = new BN(value).shiftedBy(-decimals)
  const priceUSD = currentETHPrice ? price.multipliedBy(currentETHPrice) : undefined
  return {
    assetType: asset.standard.assetClass,
    contractAddress: asset.standard.contractAddress,
    price: price.toFixed(),
    priceUSD: priceUSD.toFixed(),
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

const executeSyncNFTPorTxs = async (
  payload: any,
): Promise<void> => {
  try {
    const headers = {
      'authorization': AUTH_HEADER,
    }
    const url = `${process.env.STREAM_BASE_URL}/syncTxsFromNFTPort`
    const res = await axios.post(url, payload, { headers })
    logger.info(`Response from stream : ${JSON.stringify(res)}`)
  } catch (err) {
    logger.error(`Error in executeSyncNFTPorTxs: ${err}`)
    return
  }
}

export const getTxByContract = async (
  _: any,
  args: gql.QueryGetTxByContractArgs,
  _ctx: Context,
): Promise<gql.GetTxByContract> => {
  try {
    const { repositories } = _ctx
    const schema = Joi.object().keys({
      contractAddress: Joi.string().required(),
      chain: Joi.string().valid('ethereum').optional(),
      type: Joi.array().items(Joi.string().valid('listing', 'bid', 'cancel', 'swap', 'transfer', 'burn', 'mint', 'sale', 'list', 'all')).optional(),
      pageInput: Joi.any().optional(),
    })
    joi.validateSchema(schema, args.input)

    const { contractAddress, chain, type, pageInput } = args.input
    // Execute trigger to sync transactions from NFTPort
    const payload = {
      'address': contractAddress,
    }
    await executeSyncNFTPorTxs(payload)

    let cacheKey
    if (type && type.length) {
      cacheKey = `${CacheKeys.GET_TX_BY_CONTRACT}_${ethers.utils.getAddress(contractAddress)}_${type.join()}`
    } else {
      cacheKey = `${CacheKeys.GET_TX_BY_CONTRACT}_${ethers.utils.getAddress(contractAddress)}_all`
    }
    const cachedData = await cache.get(cacheKey)
    let indexedActivities: Array<gql.NFTPortTxByContractTransactions> = []

    if (cachedData && JSON.parse(cachedData)?.length > 0) {
      indexedActivities = JSON.parse(cachedData)
    } else {
      const chainId = chain === 'ethereum' ? '1' : '137'
      let txActivities: Array<gql.NFTPortTxByContractTransactions> = []
      const nftPortTxs = await repositories.nftPortTransaction.findTransactionsByCollection(
        type || ['all'],
        contractAddress,
        chainId,
      )
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
          for (const [index, asset] of activityDAO.order.protocolData.makeAsset.entries()) {
            if (asset.standard.contractAddress === ethers.utils.getAddress(contractAddress)) {
              priceDetails = await parsePriceDetailFromAsset(activityDAO.order.protocolData.takeAsset[index])
              activity = {
                ...activity,
                tokenId: asset.standard.tokenId,
                priceDetails,
                nft: {
                  contractAddress: asset.standard.contractAddress,
                  tokenId: asset.standard.tokenId,
                },
              }
              txActivities.push(activity)
            }
          }
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
          for (const [index, asset] of activityDAO.order.protocolData.takeAsset.entries()) {
            if (asset.standard.contractAddress === ethers.utils.getAddress(contractAddress)) {
              priceDetails = await parsePriceDetailFromAsset(activityDAO.order.protocolData.makeAsset[index])
              activity = {
                ...activity,
                tokenId: asset.standard.tokenId,
                priceDetails,
                nft: {
                  contractAddress: asset.standard.contractAddress,
                  tokenId: asset.standard.tokenId,
                },
              }
              txActivities.push(activity)
            }
          }
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
          const order = await repositories.txOrder.findOne({ where: { orderHash: activityDAO.cancel.foreignKeyId } })
          let priceDetails = undefined
          for (const [index, asset] of order.protocolData.makeAsset.entries()) {
            if (asset.standard.contractAddress === ethers.utils.getAddress(contractAddress)) {
              priceDetails = await parsePriceDetailFromAsset(order.protocolData.takeAsset[index])
              activity = {
                ...activity,
                transactionHash: activityDAO.cancel.transactionHash,
                marketplace: activityDAO.cancel.exchange,
                nft: {
                  contractAddress: asset.standard.contractAddress,
                  tokenId: asset.standard.tokenId,
                },
              }
              txActivities.push(activity)
            }
          }
          if (!priceDetails) {
            priceDetails = {
              assetType: null,
              contractAddress: null,
              price: null,
            }
            activity = {
              ...activity,
              transactionHash: activityDAO.cancel.transactionHash,
              marketplace: activityDAO.cancel.exchange,
              priceDetails,
            }
            txActivities.push(activity)
          }
        } else if (activityDAO.activityType === 'Swap') {
          activity = {
            ...activity,
            transactionHash: activityDAO.transaction.transactionHash,
            protocolData: activityDAO.transaction.protocolData,
            marketplace: activityDAO.transaction.protocol,
          }
          txActivities.push(activity)
        } else if (activityDAO.activityType === 'Sale') {
          let priceDetails = undefined
          for (const [index, asset] of activityDAO.transaction.protocolData.makeAsset.entries()) {
            if (asset.standard.contractAddress === ethers.utils.getAddress(contractAddress)) {
              priceDetails = await parsePriceDetailFromAsset(activityDAO.transaction.protocolData.takeAsset[index])
              activity = {
                ...activity,
                tokenId: asset.standard.tokenId,
                priceDetails,
                nft: {
                  contractAddress: asset.standard.contractAddress,
                  tokenId: asset.standard.tokenId,
                },
                transactionHash: activityDAO.transaction.transactionHash,
                protocolData: activityDAO.transaction.protocolData,
                marketplace: activityDAO.transaction.protocol,
                sellerAddress: activityDAO.transaction.maker,
                buyerAddress: activityDAO.transaction.taker,
              }
              txActivities.push(activity)
            }
          }
          if (!priceDetails) {
            priceDetails = {
              assetType: null,
              contractAddress: null,
              price: null,
            }
            activity = {
              ...activity,
              transactionHash: activityDAO.transaction.transactionHash,
              protocolData: activityDAO.transaction.protocolData,
              marketplace: activityDAO.transaction.protocol,
              sellerAddress: activityDAO.transaction.maker,
              buyerAddress: activityDAO.transaction.taker,
              priceDetails,
            }
            txActivities.push(activity)
          }
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
        3 * 60, // 3 min
      )
    }

    return paginatedResultFromIndexedArray(indexedActivities, pageInput)
  } catch (err) {
    logger.error(`Error in getTxByContract: ${err}`)
    Sentry.captureMessage(`Error in getTxByContract: ${err}`)
    return err
  }
}

export const getTxByNFT = async (
  _: any,
  args: gql.QueryGetTxByNFTArgs,
  _ctx: Context,
): Promise<gql.GetTxByNFT> => {
  try {
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
    // Execute trigger to sync transactions from NFTPort
    const payload = {
      'address': contractAddress,
      'tokenId': tokenId,
    }
    await executeSyncNFTPorTxs(payload)

    let cacheKey
    if (type && type.length) {
      cacheKey = `${CacheKeys.GET_TX_BY_NFT}_${ethers.utils.getAddress(contractAddress)}_${BigNumber.from(tokenId).toHexString()}_${type.join()}`
    } else {
      cacheKey = `${CacheKeys.GET_TX_BY_NFT}_${ethers.utils.getAddress(contractAddress)}_${BigNumber.from(tokenId).toHexString()}_all`
    }
    const cachedData = await cache.get(cacheKey)
    let indexedActivities: Array<gql.NFTPortTxByNftTransactions> = []

    if (cachedData && JSON.parse(cachedData)?.length > 0) {
      indexedActivities = JSON.parse(cachedData)
    } else {
      const chainId = chain === 'ethereum' ? '1' : '137'
      let txActivities: Array<gql.NFTPortTxByNftTransactions> = []
      const nftPortTxs = await repositories.nftPortTransaction.findTransactionsByNFT(
        type || ['all'],
        contractAddress,
        tokenId,
        chainId,
      )
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
          tokenId: BigNumber.from(tokenId).toHexString(),
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
            priceDetails = await parsePriceDetailFromAsset(activityDAO.order.protocolData.takeAsset[index])
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
            priceDetails = await parsePriceDetailFromAsset(activityDAO.order.protocolData.makeAsset[index])
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
          const order = await repositories.txOrder.findOne({ where: { orderHash: activityDAO.cancel.foreignKeyId } })
          let priceDetails
          const index = findNFTFromAssets(order.protocolData.makeAsset, contractAddress, tokenId)
          if (index !== -1) {
            priceDetails = await parsePriceDetailFromAsset(order.protocolData.takeAsset[index])
          } else {
            priceDetails = {
              assetType: null,
              contractAddress: null,
              price: null,
            }
          }
          activity = {
            ...activity,
            transactionHash: activityDAO.cancel.transactionHash,
            marketplace: activityDAO.cancel.exchange,
            priceDetails,
          }
        } else if (activityDAO.activityType === 'Swap') {
          activity = {
            ...activity,
            transactionHash: activityDAO.transaction.transactionHash,
            protocolData: activityDAO.transaction.protocolData,
            marketplace: activityDAO.transaction.protocol,
          }
        } else if (activityDAO.activityType === 'Sale') {
          const index = findNFTFromAssets(activityDAO.transaction.protocolData.makeAsset, contractAddress, tokenId)
          const priceDetails = index !== -1
            ? await parsePriceDetailFromAsset(activityDAO.transaction.protocolData.takeAsset[index])
            : {
              assetType: null,
              contractAddress: null,
              price: null,
            }
          activity = {
            ...activity,
            transactionHash: activityDAO.transaction.transactionHash,
            protocolData: activityDAO.transaction.protocolData,
            marketplace: activityDAO.transaction.protocol,
            sellerAddress: activityDAO.transaction.maker,
            buyerAddress: activityDAO.transaction.taker,
            priceDetails,
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
        3 * 60, // 3 min
      )
    }

    return paginatedResultFromIndexedArray(indexedActivities, pageInput)
  } catch (err) {
    logger.error(`Error in getTxByNFT: ${err}`)
    Sentry.captureMessage(`Error in getTxByNFT: ${err}`)
    return err
  }
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
