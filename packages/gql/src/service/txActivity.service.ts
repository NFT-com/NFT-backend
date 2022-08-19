import { LooksRareOrder } from '@nftcom/gql/service/looksare.service'
import { SeaportOrder } from '@nftcom/gql/service/opensea.service'
import { db, entity, helper } from '@nftcom/shared'
import { ActivityType, ExchangeType, ProtocolType } from '@nftcom/shared/defs'

type Order = SeaportOrder | LooksRareOrder

const repositories = db.newRepositories()

/**
 * orderActivityBuilder 
 * @param orderType
 * @param orderHash
 * @param walletId
 * @param chainId
 */
const orderActivityBuilder = async (
  orderType: ActivityType,
  orderHash: string,
  walletAddress: string,
  chainId: string,
): Promise<entity.TxActivity> => {
  let activity: entity.TxActivity
  if (orderHash) {
    activity = await repositories.txActivity.findOne({ where: { activityTypeId: orderHash } })
    if (activity) {
      return activity
    }
  }

  // new activity
  activity = new entity.TxActivity()
  activity.activityType = orderType
  activity.activityTypeId = orderHash
  activity.read = false
  activity.timestamp = new Date()
  activity.walletAddress = helper.checkSum(walletAddress)
  activity.chainId = chainId

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
    exchange: ExchangeType.OpenSea,
    makerAddress: order.maker?.address,
    takerAddress: order.taker?.address,
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
    exchange: ExchangeType.LooksRare,
    makerAddress: order.signer,
    takerAddress: order.strategy,
    protocolData: {
      isOrderAsk: order.isOrderAsk,
      signer: order.signer,
      collectionAddress: order.collectionAddress,
      price: order.price,
      tokenId: order.tokenId,
      amount: order.amount,
      strategy: order.strategy,
      currencyAddress: order.currencyAddress,
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
 */

export const orderEntityBuilder = async (
  protocol: ProtocolType,
  orderType: ActivityType,
  order: Order,
  chainId: string,
):  Promise<Partial<entity.TxOrder>> => {
  let orderHash: string, walletAddress: string, orderEntity: Partial<entity.TxOrder>
  let seaportOrder: SeaportOrder
  let looksrareOrder: LooksRareOrder
  switch (protocol) {
  case ProtocolType.Seaport:
    seaportOrder = order as SeaportOrder
    orderHash = seaportOrder.order_hash
    walletAddress = seaportOrder?.protocol_data?.parameters?.offerer
    orderEntity = seaportOrderBuilder(seaportOrder)
    break
  case ProtocolType.LooksRare:
    looksrareOrder = order as LooksRareOrder
    orderHash = looksrareOrder.hash
    walletAddress = looksrareOrder.signer
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
  