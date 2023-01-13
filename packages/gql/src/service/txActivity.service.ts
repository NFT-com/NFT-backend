import { BigNumber } from 'ethers'

import { cache, CacheKeys } from '@nftcom/cache'
import { gql } from '@nftcom/gql/defs'
import { pagination } from '@nftcom/gql/helper'
import { LooksRareOrder } from '@nftcom/gql/service/looksare.service'
import { SeaportConsideration, SeaportOffer, SeaportOrder } from '@nftcom/gql/service/opensea.service'
import { X2Y2Order } from '@nftcom/gql/service/x2y2.service'
import { db, defs, entity, helper, repository } from '@nftcom/shared'

type Order = SeaportOrder | LooksRareOrder | X2Y2Order

interface TxSeaportProtocolData {
  offer: SeaportOffer[]
  consideration: SeaportConsideration[]
}

interface TxLooksrareProtocolData {
  taker: string
  maker: string
  strategy: string
  currency: string
  collection: string
}

type TxProtocolData = TxSeaportProtocolData | TxLooksrareProtocolData

const repositories = db.newRepositories()

/**
 * activityBuilder
 * @param activityType - type of activity
 * @param activityHash - orderHash for off-chain, txHash for on-chain
 * @param walletAddress
 * @param chainId - chainId
 * @param nftIds
 * @param contract - asset contract
 * @param timestampFromSource - event creation timestamp of activity
 * @param expirationFromSource - expiration or null for on-chain
 */
export const activityBuilder = async (
  activityType: defs.ActivityType,
  activityHash: string,
  walletAddress: string,
  chainId: string,
  nftIds: string[],
  contract: string,
  timestampFromSource: number,
  expirationFromSource: number,
): Promise<entity.TxActivity> => {
  let activity: entity.TxActivity
  if (activityHash) {
    activity = await repositories.txActivity.findOne({ where: { activityTypeId: activityHash } })
    if (activity) {
      activity.updatedAt = new Date()
      // in case contract is not present for default contracts
      activity.nftContract = contract === '0x' ? '0x' : helper.checkSum(contract)
      return activity
    }
  }

  // new activity
  activity = new entity.TxActivity()
  activity.activityType = activityType
  activity.activityTypeId = activityHash
  activity.read = false
  activity.timestamp = new Date(timestampFromSource * 1000) // convert to ms
  activity.expiration = expirationFromSource ? new Date(expirationFromSource * 1000) : null // conver to ms
  activity.walletAddress = walletAddress === '0x' ? '0x' : helper.checkSum(walletAddress)
  activity.chainId = chainId
  activity.nftContract = contract === '0x' ? '0x' : helper.checkSum(contract)
  activity.nftId = [...nftIds]
  activity.status = defs.ActivityStatus.Valid

  return activity
}

/**
 * seaportOrderBuilder
 * @param order
 */
const seaportOrderBuilder = (
  order: SeaportOrder,
): Partial<entity.TxOrder> => {
  return {
    exchange: defs.ExchangeType.OpenSea,
    makerAddress: order.maker?.address ? helper.checkSum(order.maker?.address): null,
    takerAddress: order.taker?.address ? helper.checkSum(order.taker?.address): null,
    nonce: order.protocol_data?.parameters?.counter, // counter is mapped to nonce for OS
    zone: order.protocol_data?.parameters?.zone, // only mapped for OS
    protocolData: {
      ...order.protocol_data,
    },
  }
}

/**
 * looksrareOrderBuilder
 * @param order
 */

const looksrareOrderBuilder = (
  order: LooksRareOrder,
): Partial<entity.TxOrder> => {
  return {
    exchange: defs.ExchangeType.LooksRare,
    makerAddress: helper.checkSum(order.signer),
    takerAddress: null,
    nonce: Number(order.nonce),
    protocolData: {
      isOrderAsk: order.isOrderAsk,
      signer: helper.checkSum(order.signer),
      collectionAddress: helper.checkSum(order.collectionAddress),
      price: order.price,
      tokenId: order.tokenId,
      amount: order.amount,
      strategy: helper.checkSum(order.strategy),
      currencyAddress: helper.checkSum(order.currencyAddress),
      nonce: order.nonce,
      startTime: order.startTime,
      endTime: order.endTime,
      minPercentageToAsk: order.minPercentageToAsk,
      params: order.params || '0x',
      v: order.v,
      r: order.r,
      s: order.s,
    },
  }
}

/**
 * x2y2OrderBuilder
 * @param order
 */

const x2y2OrderBuilder = (
  order: X2Y2Order,
): Partial<entity.TxOrder> => {
  return {
    exchange: defs.ExchangeType.X2Y2,
    makerAddress: helper.checkSum(order.maker),
    takerAddress: order.taker ? helper.checkSum(order.taker) : null,
    nonce: Number(order.id),
    protocolData: {
      side: order.side,
      type: order.type,
      erc_type: order.erc_type,
      status: order.status,
      maker: helper.checkSum(order.maker),
      contract: helper.checkSum(order.token.contract),
      price: order.price,
      amount: order.amount,
      tokenId: order.token.token_id,
      currencyAddress: helper.checkSum(order.currency),
      id: order.id,
      created_at: order.created_at,
      updated_at: order.updated_at,
      end_at: order.end_at,
      royalty_fee: order.royalty_fee,
      is_collection_offer: order.is_collection_offer,
      is_bundle: order.is_bundle,
      is_private: order.is_private,
    },
  }
}

/**
 * orderEntityBuilder
 * @param protocol
 * @param orderType
 * @param order
 * @param chainId
 * @param contract
 */

export const orderEntityBuilder = async (
  protocol: defs.ProtocolType,
  orderType: defs.ActivityType,
  order: Order,
  chainId: string,
  contract: string,
):  Promise<Partial<entity.TxOrder>> => {
  let orderHash: string,
    walletAddress: string,
    tokenId: string,
    orderEntity: Partial<entity.TxOrder>,
    nftIds: string[],
    timestampFromSource: number,
    expirationFromSource: number

  let seaportOrder: SeaportOrder
  let looksrareOrder: LooksRareOrder
  let x2y2Order: X2Y2Order
  const checksumContract: string = helper.checkSum(contract)
  switch (protocol) {
  case defs.ProtocolType.Seaport:
    seaportOrder = order as SeaportOrder
    orderHash = seaportOrder.order_hash
    walletAddress = helper.checkSum(seaportOrder?.protocol_data?.parameters?.offerer)
    timestampFromSource = Number(seaportOrder?.protocol_data?.parameters?.startTime)
    expirationFromSource = Number(seaportOrder?.protocol_data?.parameters?.endTime)
    nftIds = seaportOrder?.protocol_data?.parameters?.offer?.map((offer: SeaportOffer) => {
      tokenId = BigNumber.from(offer.identifierOrCriteria).toHexString()
      return `ethereum/${checksumContract}/${tokenId}`
    })
    orderEntity = seaportOrderBuilder(seaportOrder)
    break
  case defs.ProtocolType.LooksRare:
    looksrareOrder = order as LooksRareOrder
    orderHash = looksrareOrder.hash
    walletAddress = helper.checkSum(looksrareOrder.signer)
    tokenId = BigNumber.from(looksrareOrder.tokenId).toHexString()
    timestampFromSource = Number(looksrareOrder.startTime)
    expirationFromSource =  Number(looksrareOrder.endTime)
    nftIds = [`ethereum/${checksumContract}/${tokenId}`]
    orderEntity = looksrareOrderBuilder(looksrareOrder)
    break
  case defs.ProtocolType.X2Y2:
    x2y2Order = order as X2Y2Order
    orderHash = x2y2Order.item_hash
    walletAddress = helper.checkSum(x2y2Order.maker)
    tokenId = BigNumber.from(x2y2Order.token.token_id || 0).toHexString()
    timestampFromSource = Number(x2y2Order.created_at)
    expirationFromSource = Number(x2y2Order.end_at)
    nftIds = [`ethereum/${checksumContract}/${tokenId}`]
    orderEntity = x2y2OrderBuilder(x2y2Order)
    break
  default:
    break
  }

  const activity: entity.TxActivity = await activityBuilder(
    orderType,
    orderHash,
    walletAddress,
    chainId,
    nftIds,
    checksumContract,
    timestampFromSource,
    expirationFromSource,
  )

  return {
    id: orderHash,
    activity,
    orderType,
    orderHash,
    chainId,
    protocol,
    ...orderEntity,
  }
}
/**
 * txSeaportProcotolDataParser
 * @param protocolData
 */

export const txSeaportProcotolDataParser = (protocolData: any): TxSeaportProtocolData => {
  const { offer, consideration } = protocolData
  const txOffer: SeaportOffer[] = offer.map((offerItem: any) => {
    const [itemType, token, identifierOrCriteria, amount] = offerItem
    return {
      itemType,
      token: helper.checkSum(token),
      identifierOrCriteria: helper.bigNumberToNumber(identifierOrCriteria),
      startAmount: helper.bigNumberToNumber(amount),
      endAmount: helper.bigNumberToNumber(amount),
    }
  })

  const txConsideration: SeaportConsideration[] = consideration.map((considerationItem: any) => {
    const [itemType, token, identifierOrCriteria, amount, recipient] = considerationItem
    return {
      itemType,
      token: helper.checkSum(token),
      identifierOrCriteria: helper.bigNumberToNumber(identifierOrCriteria),
      startAmount: helper.bigNumberToNumber(amount),
      endAmount: helper.bigNumberToNumber(amount),
      recipient: helper.checkSum(recipient),
    }
  })

  return  { offer: txOffer, consideration: txConsideration }
}

/**
 * transactionEntityBuilder
 * @param txType
 * @param txHash
 * @param chainId
 * @param contract
 * @param tokenId
 */

export const txEntityBuilder = async (
  txType: defs.ActivityType,
  txHash: string,
  blockNumber: string,
  chainId: string,
  contract: string,
  tokenId: string,
  maker: string,
  taker: string,
  exchange: defs.ExchangeType,
  protocol: defs.ProtocolType,
  protocolData: any,
  eventType: string,
):  Promise<Partial<entity.TxTransaction>> => {
  const checksumContract: string = helper.checkSum(contract)
  const tokenIdHex: string = helper.bigNumberToHex(tokenId)
  const nftIds: string[] = [`ethereum/${checksumContract}/${tokenIdHex}`]
  const timestampFromSource: number = (new Date().getTime())/1000
  const expirationFromSource = null

  const activity: entity.TxActivity = await activityBuilder(
    txType,
    txHash,
    maker,
    chainId,
    nftIds,
    checksumContract,
    timestampFromSource,
    expirationFromSource,
  )

  let txProtocolData: TxProtocolData = protocolData

  if (protocol === defs.ProtocolType.Seaport) {
    txProtocolData =  txSeaportProcotolDataParser(protocolData)
  }
  return {
    id: txHash,
    activity,
    exchange,
    transactionType: txType,
    protocol,
    protocolData: txProtocolData,
    transactionHash: txHash,
    blockNumber,
    nftContractAddress: checksumContract,
    nftContractTokenId: tokenIdHex,
    eventType,
    maker: helper.checkSum(maker),
    taker: helper.checkSum(taker),
    chainId,
  }
}

/**
 * cancelEntityBuilder
 * @param txType
 * @param txHash
 * @param chainId
 * @param contract
 * @param nftIds
 * @param maker
 * @param exchange
 * @param orderType
 * @param orderHash
 */

export const cancelEntityBuilder = async (
  txType: defs.ActivityType,
  txHash: string,
  blockNumber: string,
  chainId: string,
  contract: string,
  nftIds: string[],
  maker: string,
  exchange: defs.ExchangeType,
  orderType: defs.CancelActivityType,
  orderHash: string,
):  Promise<Partial<entity.TxCancel>> => {
  const checksumContract: string = helper.checkSum(contract)
  const timestampFromSource: number = (new Date().getTime())/1000
  const expirationFromSource = null

  const activity: entity.TxActivity = await activityBuilder(
    txType,
    txHash,
    maker,
    chainId,
    nftIds,
    checksumContract,
    timestampFromSource,
    expirationFromSource,
  )

  return {
    id: txHash,
    activity,
    exchange,
    foreignType: orderType,
    foreignKeyId: orderHash,
    transactionHash: txHash,
    blockNumber,
    chainId,
  }
}

/**
 * paginatedActivitiesBy
 * @param repo - activity repo
 * @param pageInput
 * @param filters
 * @param relations
 * @param orderKey
 * @param orderDirection
 * @param protocol
 * @param distinctOn
 */

export const paginatedActivitiesBy = (
  repo: repository.TxActivityRepository,
  pageInput: gql.PageInput,
  filters: Partial<entity.TxActivity>[],
  relations: string[],
  orderKey= 'createdAt',
  orderDirection = 'DESC',
  protocol?: gql.ProtocolType,
  distinctOn?: defs.DistinctOn<entity.TxActivity>,
): Promise<defs.PageableResult<entity.TxActivity>> => {
  const pageableFilters = pagination.toPageableFilters(pageInput, filters, orderKey)
  const orderBy = <defs.OrderBy>{ [`activity.${orderKey}`]: orderDirection }
  const reversedOrderDirection = orderDirection === 'DESC' ? 'ASC' : 'DESC'
  const reversedOrderBy = <defs.OrderBy>{ [`activity.${orderKey}`]: reversedOrderDirection }
  return pagination.resolvePage<entity.TxActivity>(pageInput, {
    firstAfter: () => repo.findActivities({
      filters: pageableFilters,
      relations: relations,
      orderBy,
      take: pageInput.first,
      distinctOn,
    },
    protocol,
    ),
    firstBefore: () => repo.findActivities({
      filters: pageableFilters,
      relations: relations,
      orderBy,
      take: pageInput.first,
      distinctOn,
    },
    protocol,
    ),
    lastAfter: () => repo.findActivities({
      filters: pageableFilters,
      relations: relations,
      orderBy: reversedOrderBy,
      take: pageInput.last,
      distinctOn,
    }, protocol).then(pagination.reverseResult),
    lastBefore: () => repo.findActivities({
      filters: pageableFilters,
      relations: relations,
      orderBy: reversedOrderBy,
      take: pageInput.last,
      distinctOn,
    }, protocol).then(pagination.reverseResult),
  })
}

/**
 * triggerNFTOrderRefreshQueue
 * @param nft
 * @param chainId
 * @param forced
 */
export const triggerNFTOrderRefreshQueue = async (
  nfts: any[],
  chainId: string,
  forced?: boolean,
): Promise<number> => {
  if(!nfts.length) {
    return Promise.resolve(0)
  }
  const nftRefreshKeys: string[] = []
  // O(N)
  for (const nft of nfts) {
    const nftKey = `${nft.contract}:${nft.tokenId}`
    // O(1)
    if (forced) {
      nftRefreshKeys.push(...['1', nftKey])
    } else {
      const itemPresentInRefreshedCache: string = await cache.zscore(`${CacheKeys.REFRESHED_NFT_ORDERS_EXT}_${chainId}`, nftKey)
      if (!itemPresentInRefreshedCache) {
        nftRefreshKeys.push(...['1', nftKey])
      }
    }
  }
  if(!nftRefreshKeys.length) {
    return Promise.resolve(0)
  }
  return Promise.resolve(cache.zadd(`${CacheKeys.REFRESH_NFT_ORDERS_EXT}_${chainId}`, ...nftRefreshKeys))
}
