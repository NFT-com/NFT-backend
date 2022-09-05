import { BigNumber } from 'ethers'

import { gql } from '@nftcom/gql/defs'
import { pagination } from '@nftcom/gql/helper'
import { LooksRareOrder } from '@nftcom/gql/service/looksare.service'
import { SeaportOffer, SeaportOrder } from '@nftcom/gql/service/opensea.service'
import { db, defs, entity, helper, repository } from '@nftcom/shared'

type Order = SeaportOrder | LooksRareOrder

const repositories = db.newRepositories()

/**
 * orderActivityBuilder 
 * @param orderType
 * @param orderHash
 * @param walletId
 * @param chainId
 * @param contract
 * @param timestampFromSource
 * @param expirationFromSource
 */
const orderActivityBuilder = async (
  orderType: defs.ActivityType,
  orderHash: string,
  walletAddress: string,
  chainId: string,
  nftIds: string[],
  contract: string,
  timestampFromSource: number,
  expirationFromSource: number,
): Promise<entity.TxActivity> => {
  let activity: entity.TxActivity
  if (orderHash) {
    activity = await repositories.txActivity.findOne({ where: { activityTypeId: orderHash } })
    if (activity) {
      activity.updatedAt = new Date()
      // in case contract is not present for default contracts
      activity.nftContract = helper.checkSum(contract)
      return activity
    }
  }

  // new activity
  activity = new entity.TxActivity()
  activity.activityType = orderType
  activity.activityTypeId = orderHash
  activity.read = false
  activity.timestamp = new Date(timestampFromSource)
  activity.expiration = new Date(expirationFromSource)
  activity.walletAddress = helper.checkSum(walletAddress)
  activity.chainId = chainId
  activity.nftContract = helper.checkSum(contract)
  activity.nftId = [...nftIds]

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
  switch (protocol) {
  case defs.ProtocolType.Seaport:
    seaportOrder = order as SeaportOrder
    orderHash = seaportOrder.order_hash
    walletAddress = seaportOrder?.protocol_data?.parameters?.offerer
    timestampFromSource = Number(seaportOrder?.protocol_data?.parameters?.startTime)
    expirationFromSource = Number(seaportOrder?.protocol_data?.parameters?.endTime)
    nftIds = seaportOrder?.protocol_data?.parameters?.offer?.map((offer: SeaportOffer) => {
      tokenId = BigNumber.from(offer.identifierOrCriteria).toHexString()
      return `ethereum/${contract}/${tokenId}`
    })
    orderEntity = seaportOrderBuilder(seaportOrder)
    break
  case defs.ProtocolType.LooksRare:
    looksrareOrder = order as LooksRareOrder
    orderHash = looksrareOrder.hash
    walletAddress = looksrareOrder.signer
    tokenId = BigNumber.from(looksrareOrder.tokenId).toHexString()
    timestampFromSource = Number(looksrareOrder.startTime)
    expirationFromSource =  Number(looksrareOrder.endTime)
    nftIds = [`ethereum/${contract}/${tokenId}`]
    orderEntity = looksrareOrderBuilder(looksrareOrder)
    break
  default:
    break
  }

  const activity: entity.TxActivity = await orderActivityBuilder(
    orderType,
    orderHash,
    walletAddress,
    chainId,
    nftIds,
    contract,
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

export const paginatedActivitiesBy = (
  repo: repository.TxActivityRepository,
  pageInput: gql.PageInput,
  filters: Partial<entity.TxActivity>[],
  relations: string[],
  orderKey= 'createdAt',
  orderDirection = 'DESC',
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
    }),
    firstBefore: () => repo.findActivities({
      filters: pageableFilters,
      relations: relations,
      orderBy,
      take: pageInput.first,
      distinctOn,
    }),
    lastAfter: () => repo.findActivities({
      filters: pageableFilters,
      relations: relations,
      orderBy: reversedOrderBy,
      take: pageInput.last,
      distinctOn,
    }).then(pagination.reverseResult),
    lastBefore: () => repo.findActivities({
      filters: pageableFilters,
      relations: relations,
      orderBy: reversedOrderBy,
      take: pageInput.last,
      distinctOn,
    }).then(pagination.reverseResult),
  })
}
  