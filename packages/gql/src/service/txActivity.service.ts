import { BigNumber as BN } from 'bignumber.js'
import { BigNumber, utils } from 'ethers'

import { cache, CacheKeys } from '@nftcom/cache'
import { getDecimalsForContract, getSymbolForContract } from '@nftcom/contract-data'
import { gql } from '@nftcom/gql/defs'
import { pagination } from '@nftcom/gql/helper'
import { LooksRareOrderV2 } from '@nftcom/gql/service/looksare.service'
import { SeaportConsideration, SeaportOffer, SeaportOrder } from '@nftcom/gql/service/opensea.service'
import { X2Y2Order } from '@nftcom/gql/service/x2y2.service'
import { db, defs, entity, helper, repository } from '@nftcom/shared'

import { getSymbolInUsd } from './core.service'

type Order = SeaportOrder | LooksRareOrderV2 | X2Y2Order

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
const seaportOrderBuilder = (order: SeaportOrder): Partial<entity.TxOrder> => {
  return {
    exchange: defs.ExchangeType.OpenSea,
    makerAddress: order.maker?.address ? helper.checkSum(order.maker?.address) : null,
    takerAddress: order.taker?.address ? helper.checkSum(order.taker?.address) : null,
    osNonce: order.protocol_data?.parameters?.counter?.toString(), // counter is mapped to nonce for OS
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

const looksrareOrderBuilder = (order: LooksRareOrderV2): Partial<entity.TxOrder> => {
  return {
    exchange: defs.ExchangeType.LooksRare,
    makerAddress: helper.checkSum(order.signer),
    takerAddress: null,
    nonce: Number(order.globalNonce),
    protocolData: {
      ...order,
      signer: helper.checkSum(order.signer),
      collectionAddress: helper.checkSum(order.collection),
      currencyAddress: helper.checkSum(order.currency),
    },
  }
}

/**
 * x2y2OrderBuilder
 * @param order
 */

const x2y2OrderBuilder = (order: X2Y2Order): Partial<entity.TxOrder> => {
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
): Promise<Partial<entity.TxOrder>> => {
  let orderHash: string,
    walletAddress: string,
    tokenId: string,
    orderEntity: Partial<entity.TxOrder>,
    nftIds: string[],
    timestampFromSource: number,
    expirationFromSource: number

  let seaportOrder: SeaportOrder
  let looksrareOrder: LooksRareOrderV2
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
      looksrareOrder = order as LooksRareOrderV2
      orderHash = looksrareOrder.hash
      walletAddress = helper.checkSum(looksrareOrder.signer)
      tokenId = BigNumber.from(looksrareOrder.itemIds[0]).toHexString()
      timestampFromSource = Number(looksrareOrder.startTime)
      expirationFromSource = Number(looksrareOrder.endTime)
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

  return { offer: txOffer, consideration: txConsideration }
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
): Promise<Partial<entity.TxTransaction>> => {
  const checksumContract: string = helper.checkSum(contract)
  const tokenIdHex: string = helper.bigNumberToHex(tokenId)
  const nftIds: string[] = [`ethereum/${checksumContract}/${tokenIdHex}`]
  const timestampFromSource: number = new Date().getTime() / 1000
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
    txProtocolData = txSeaportProcotolDataParser(protocolData)
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
): Promise<Partial<entity.TxCancel>> => {
  const checksumContract: string = helper.checkSum(contract)
  const timestampFromSource: number = new Date().getTime() / 1000
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
  orderKey = 'createdAt',
  orderDirection = 'DESC',
  protocol?: gql.ProtocolType,
  distinctOn?: defs.DistinctOn<entity.TxActivity>,
): Promise<defs.PageableResult<entity.TxActivity>> => {
  const pageableFilters = pagination.toPageableFilters(pageInput, filters, orderKey)
  const orderBy = <defs.OrderBy>{ [`activity.${orderKey}`]: orderDirection }
  const reversedOrderDirection = orderDirection === 'DESC' ? 'ASC' : 'DESC'
  const reversedOrderBy = <defs.OrderBy>{ [`activity.${orderKey}`]: reversedOrderDirection }
  return pagination.resolvePage<entity.TxActivity>(pageInput, {
    firstAfter: () =>
      repo.findActivities(
        {
          filters: pageableFilters,
          relations: relations,
          orderBy,
          take: pageInput.first,
          distinctOn,
        },
        protocol,
      ),
    firstBefore: () =>
      repo.findActivities(
        {
          filters: pageableFilters,
          relations: relations,
          orderBy,
          take: pageInput.first,
          distinctOn,
        },
        protocol,
      ),
    lastAfter: () =>
      repo
        .findActivities(
          {
            filters: pageableFilters,
            relations: relations,
            orderBy: reversedOrderBy,
            take: pageInput.last,
            distinctOn,
          },
          protocol,
        )
        .then(pagination.reverseResult),
    lastBefore: () =>
      repo
        .findActivities(
          {
            filters: pageableFilters,
            relations: relations,
            orderBy: reversedOrderBy,
            take: pageInput.last,
            distinctOn,
          },
          protocol,
        )
        .then(pagination.reverseResult),
  })
}

/**
 * triggerNFTOrderRefreshQueue
 * @param nft
 * @param chainId
 * @param forced
 */
export const triggerNFTOrderRefreshQueue = async (nfts: any[], chainId: string, forced?: boolean): Promise<number> => {
  if (!nfts.length) {
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
      const itemPresentInRefreshedCache: string = await cache.zscore(
        `${CacheKeys.REFRESHED_NFT_ORDERS_EXT}_${chainId}`,
        nftKey,
      )
      if (!itemPresentInRefreshedCache) {
        nftRefreshKeys.push(...['1', nftKey])
      }
    }
  }
  if (!nftRefreshKeys.length) {
    return Promise.resolve(0)
  }
  return Promise.resolve(cache.zadd(`${CacheKeys.REFRESH_NFT_ORDERS_EXT}_${chainId}`, ...nftRefreshKeys))
}

export type TxActivityDAO = entity.TxActivity & { order: entity.TxOrder }

export const getListingPrice = (listing: TxActivityDAO): BigNumber => {
  switch (listing?.order?.protocol) {
    case defs.ProtocolType.LooksRare:
    case defs.ProtocolType.X2Y2: {
      const order = listing?.order?.protocolData
      return BigNumber.from(order?.price || 0)
    }
    case defs.ProtocolType.Seaport: {
      const order = listing?.order?.protocolData
      return order?.parameters?.consideration?.reduce(
        (total, consideration) => total.add(BigNumber.from(consideration?.startAmount || 0)),
        BigNumber.from(0),
      )
    }
    case defs.ProtocolType.NFTCOM: {
      const order = listing?.order?.protocolData
      return BigNumber.from(order?.takeAsset[0]?.value ?? 0)
    }
  }
}

export const getListingCurrencyAddress = (listing: TxActivityDAO): string => {
  switch (listing?.order?.protocol) {
    case defs.ProtocolType.LooksRare:
    case defs.ProtocolType.X2Y2: {
      const order = listing?.order?.protocolData
      return order?.currencyAddress ?? order?.['currency']
    }
    case defs.ProtocolType.Seaport: {
      const order = listing?.order?.protocolData
      return order?.parameters?.consideration?.[0]?.token
    }
    case defs.ProtocolType.NFTCOM: {
      const order = listing?.order?.protocolData
      return order?.takeAsset[0]?.standard?.contractAddress ?? order?.['currency']
    }
  }
}

const isSupportedCurrency = async (txActivity: TxActivityDAO): Promise<boolean> => {
  return ['ETH', 'WETH', 'USDC'].includes(await getSymbolForContract(getListingCurrencyAddress(txActivity)))
}

const LR_DUTCH_AUCTION = process.env.TYPESENSE_HOST.startsWith('dev')
  ? '0x550fBf31d44f72bA7b4e4bf567C72463C4d6CEDB'
  : '0x3E80795Cae5Ee215EBbDf518689467Bf4243BAe0'

const transactionIsBuyNow = (order: entity.TxOrder): boolean => {
  return (
    order.exchange === defs.ExchangeType.X2Y2 ||
    (order.exchange === defs.ExchangeType.OpenSea && !!order.protocolData?.parameters?.consideration?.length) ||
    (order.exchange === defs.ExchangeType.LooksRare && order.protocolData?.strategy !== LR_DUTCH_AUCTION) ||
    (order.exchange === defs.ExchangeType.NFTCOM && order.protocolData.auctionType === defs.AuctionType.FixedPrice)
  )
}

const nonceIsLarger = (n1, n2): boolean => {
  return n1 - n2 > 0
}

const priceIsLower = async (l1, l2): Promise<boolean> => {
  const addrCurrL1 = getListingCurrencyAddress(l1)
  const priceL1 = new BN(utils.formatUnits(getListingPrice(l1), await getDecimalsForContract(addrCurrL1)))
  const currencyL1 = await getSymbolForContract(addrCurrL1)

  const addrCurrL2 = getListingCurrencyAddress(l1)
  const priceL2 = new BN(utils.formatUnits(getListingPrice(l2), await getDecimalsForContract(addrCurrL2)))
  const currencyL2 = await getSymbolForContract(addrCurrL2)

  if (currencyL1 === currencyL2) {
    return priceL1.isLessThan(priceL2)
  }

  const priceUsdL1 = await getSymbolInUsd(currencyL1)
  const priceUsdL2 = await getSymbolInUsd(currencyL2)
  return priceL1.multipliedBy(priceUsdL1).isLessThan(priceL2.multipliedBy(priceUsdL2))
}

export const listingMapFrom = async (txActivities: TxActivityDAO[]): Promise<{ [k: string]: TxActivityDAO[] }> => {
  return (
    await txActivities.reduce(async (agg, txActivity) => {
      const listings = await agg
      if (
        (await isSupportedCurrency(txActivity)) &&
        transactionIsBuyNow(txActivity.order) &&
        txActivity.order?.exchange
      ) {
        const existingIdx = listings.findIndex(tx => {
          return tx.order?.exchange && txActivity.order?.exchange && tx.order.exchange === txActivity.order.exchange
        })
        if (
          existingIdx > -1 &&
          (nonceIsLarger(txActivity.order.nonce, listings[existingIdx].order.nonce) ||
            (txActivity.order.nonce === listings[existingIdx].order.nonce &&
              (await priceIsLower(txActivity, listings[existingIdx]))))
        ) {
          listings[existingIdx] = txActivity
        } else {
          listings.push(txActivity)
        }
      }
      return listings
    }, Promise.resolve([] as TxActivityDAO[]))
  ).reduce((map, txActivity: TxActivityDAO) => {
    if (helper.isNotEmpty(txActivity.order?.protocolData)) {
      const nftIdParts = txActivity.nftId[0].split('/')
      const k = `${nftIdParts[1]}-${nftIdParts[2]}`
      if (map[k]?.length) {
        map[k].push(txActivity)
      } else {
        map[k] = [txActivity]
      }
    }
    return map
  }, {})
}
