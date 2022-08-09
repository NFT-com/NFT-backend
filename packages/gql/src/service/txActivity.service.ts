import { LooksRareOrder } from '@nftcom/gql/service/looksare.service'
import { SeaportOrder } from '@nftcom/gql/service/opensea.service'
import { db } from '@nftcom/shared'
import { TxActivity, TxOrder } from '@nftcom/shared/db/entity'
import { ActivityType, ExchangeType, ProtocolType } from '@nftcom/shared/defs'

const repositories = db.newRepositories()

const orderActivityBuilder = async (
  orderType: ActivityType,
  orderHash: string,
  walletId: string,
  chainId: string,
): Promise<TxActivity> => {
  let activity: TxActivity
  if (orderHash) {
    activity = await repositories.txActivity.findOne({ where: { activityTypeId: orderHash } })
    if (activity) {
      return activity
    }
  }

  // new activity
  activity = new TxActivity()
  activity.activityType = orderType
  activity.activityTypeId = orderHash
  activity.read = false
  activity.timestamp = new Date()
  activity.walletId = walletId
  activity.chainId = chainId

  return activity
}

const seaportOrderBuilder = (
  order: SeaportOrder,
): Partial<TxOrder> => {
  return {
    exchange: ExchangeType.OpenSea,
    makerAddress: order.maker?.address,
    takerAddress: order.taker?.address,
    protocolData: {
      ...order.protocol_data,
    },
  }
}

const looksrareOrderBuilder = (
  order: LooksRareOrder,
): Partial<TxOrder> => {
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
  order: SeaportOrder & LooksRareOrder,
  chainId: string,
):  Promise<Partial<TxOrder>> => {
  let orderHash: string, walletId: string, orderEntity: Partial<TxOrder>

  switch (protocol) {
  case ProtocolType.Seaport:
    orderHash = order.order_hash
    walletId = order?.protocol_data?.parameters?.offerer
    orderEntity = seaportOrderBuilder(order)
    break
  case ProtocolType.LooksRare:
    orderHash = order.hash
    walletId = order.signer
    orderEntity = looksrareOrderBuilder(order)
    break
  default:
    break
  }

  const activity: TxActivity = await orderActivityBuilder(
    orderType,
    orderHash,
    walletId,
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
  