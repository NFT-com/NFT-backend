import axios, { AxiosError, AxiosInstance, AxiosResponse } from 'axios'
import axiosRetry, { IAxiosRetryConfig } from 'axios-retry'
import { BigNumber, BigNumberish } from 'ethers'

import { _logger, defs, entity } from '@nftcom/shared'

import { delay } from './core.service'
import { orderEntityBuilder } from './txActivity.service'

const X2Y2_API_BASE_URL = 'https://api.x2y2.org'
const X2Y2_API_TESTNET_BASE_URL = 'https://goerli-api.x2y2.org'
const X2Y2_LISTING_BATCH_SIZE = 4
const X2Y2_API_KEY = process.env.X2Y2_API_KEY

// types
// const orderItemParamType = 'tuple(uint256 price, bytes data)'
// const orderParamType = `tuple(uint256 salt, address user, uint256 network, uint256 intent, uint256 delegateType, uint256 deadline, address currency, bytes dataMask, ${orderItemParamType}[] items, bytes32 r, bytes32 s, uint8 v, uint8 signVersion)`

const logger = _logger.Factory(_logger.Context.X2Y2)
export interface X2Y2OrderRequest {
  contract: string
  tokenId: string
  chainId: string
}

export type X2Y2OrderItem = {
  price: BigNumberish
  data: string
}

// creation payload
export interface X2Y2OrderPayload {
  salt: BigNumberish
  user: string
  network: BigNumberish
  intent: BigNumberish
  delegateType: BigNumberish
  deadline: BigNumberish
  currency: string
  dataMask: string
  items: X2Y2OrderItem[]
  // signature
  r: string
  s: string
  v: number
  signVersion: number
}

export interface X2Y2Order {
  amount: number
  created_at: number // timestamp
  currency: string // address
  end_at: number // timestamp
  erc_type: number // timestamp
  id: number
  is_bundle: false
  is_collection_offer: false
  is_private: false
  item_hash: string
  maker: string
  price: string
  royalty_fee: number
  side: number
  status: string
  taker: string | null
  token: {
    contract: string
    erc_type: string
    token_id: string
  }
  type: string
  updated_at: number
}

export interface X2Y2ExternalOrder {
  listings: entity.TxOrder[]
  offers: entity.TxOrder[]
}

const getX2Y2Interceptor = (baseURL: string): AxiosInstance => {
  const x2y2Instance = axios.create({
    baseURL,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-API-Key': X2Y2_API_KEY,
    },
  })
  // retry logic with exponential backoff
  const retryOptions: IAxiosRetryConfig = {
    retries: 3,
    retryCondition: (err: AxiosError<any>) => {
      return axiosRetry.isNetworkOrIdempotentRequestError(err) || err.response.status === 429
    },
    retryDelay: (retryCount: number, err: AxiosError<any>) => {
      if (err.response) {
        const retry_after = err.response.headers['retry-after']
        if (retry_after) {
          return retry_after
        }
      }
      return axiosRetry.exponentialDelay(retryCount)
    },
  }
  axiosRetry(x2y2Instance as any, retryOptions)
  return x2y2Instance
}

/**
 * Retrieve listings in batches
 * @param listingQueryParams
 * @param chainId
 * @param batchSize
 */
const retrieveX2Y2ListingsInBatches = async (
  listingQueryParams: string[],
  chainId: string,
  batchSize: number,
): Promise<entity.TxOrder[]> => {
  const listings: any[] = []
  let queryUrl
  const listingBaseUrl = chainId === '5' ? X2Y2_API_TESTNET_BASE_URL : X2Y2_API_BASE_URL
  const listingInterceptorX2Y2 = getX2Y2Interceptor(listingBaseUrl)
  let delayCounter = 0
  let size: number
  while (listingQueryParams.length > 0) {
    size = batchSize
    queryUrl = listingQueryParams.pop()
    const response: AxiosResponse = await listingInterceptorX2Y2(`/v1/orders?${queryUrl}&sort=price&direction=asc`)

    if (response?.data?.data?.length) {
      const orders = response?.data?.data
      listings.push(
        orderEntityBuilder(
          defs.ProtocolType.X2Y2,
          defs.ActivityType.Listing,
          orders?.[0],
          chainId,
          orders?.[0]?.token?.contract,
        ),
      )
    }
    delayCounter = delayCounter + 1
    if (delayCounter === size) {
      await delay(1000)
      delayCounter = 0
    }
  }

  return await Promise.all(listings)
}

/**
 * Retrieve listings in batches
 * @param offersQueryParams
 * @param chainId
 * @param batchSize
 */
const retrieveX2Y2OffersInBatches = async (
  offerQueryParams: string[],
  chainId: string,
  batchSize: number,
): Promise<entity.TxOrder[]> => {
  const offers: any[] = []
  let queryUrl
  const offerBaseUrl = chainId === '5' ? X2Y2_API_TESTNET_BASE_URL : X2Y2_API_BASE_URL
  const offerInterceptorX2Y2 = getX2Y2Interceptor(offerBaseUrl)
  let delayCounter = 0
  let size: number
  while (offerQueryParams.length > 0) {
    size = batchSize
    queryUrl = offerQueryParams.pop()
    const response: AxiosResponse = await offerInterceptorX2Y2(`/v1/offers?${queryUrl}&sort=price&direction=desc`)

    if (response?.data?.data?.length) {
      const orders = response?.data?.data
      offers.push(
        orderEntityBuilder(
          defs.ProtocolType.X2Y2,
          defs.ActivityType.Bid,
          orders?.[0],
          chainId,
          orders?.[0]?.token?.contract,
        ),
      )
    }
    delayCounter = delayCounter + 1
    if (delayCounter === size) {
      await delay(1000)
      delayCounter = 0
    }
  }

  return await Promise.all(offers)
}

/**
 * Retrieve multiple sell or buy orders
 * @param looksrareMultiOrderRequest
 * @param chainId
 * @param includeOffers
 */
export const retrieveMultipleOrdersX2Y2 = async (
  x2y2MultiOrderRequest: Array<X2Y2OrderRequest>,
  chainId: string,
  includeOffers: boolean,
): Promise<X2Y2ExternalOrder> => {
  const responseAggregator: X2Y2ExternalOrder = {
    listings: [],
    offers: [],
  }

  try {
    if (x2y2MultiOrderRequest?.length) {
      const listingQueries: Array<string> = []
      const offerQueries: Array<string> = []
      for (const x2y2Req of x2y2MultiOrderRequest) {
        const queryParam = `contract=${x2y2Req.contract}&token_id=${x2y2Req.tokenId}`
        if (!listingQueries.includes(queryParam)) {
          listingQueries.push(queryParam)
        }
        if (includeOffers && !offerQueries.includes(queryParam)) {
          offerQueries.push(queryParam)
        }
      }

      if (listingQueries.length) {
        responseAggregator.listings = await retrieveX2Y2ListingsInBatches(
          listingQueries,
          chainId,
          X2Y2_LISTING_BATCH_SIZE,
        )
      }

      if (includeOffers && offerQueries.length) {
        responseAggregator.offers = await retrieveX2Y2OffersInBatches(offerQueries, chainId, X2Y2_LISTING_BATCH_SIZE)
      }
    }
  } catch (err) {
    logger.error(`Error in retrieveMultipleOrdersX2Y2: ${err}`)
    // Sentry.captureMessage(`Error in retrieveOrdersLooksrare: ${err}`)
  }
  // logger.log('response aggregator', responseAggregator)
  return responseAggregator
}

// retrieveMultipleOrdersX2Y2([{ contract: '0x93317e87a3a47821803caadc54ae418af80603da', tokenId: '0', chainId: '1' }], '1', false)

// export function encodeOrder(order: X2Y2OrderPayload): string {
//   return ethers.utils.defaultAbiCoder.encode([orderParamType], [order])
// }

const retriveOrderX2Y2 = async (
  maker: string,
  contract: string,
  tokenId: string,
  chainId: string,
): Promise<X2Y2Order | null> => {
  const baseUrl = chainId === '1' ? X2Y2_API_BASE_URL : X2Y2_API_TESTNET_BASE_URL
  const token: string = BigNumber.from(tokenId).toString()
  try {
    const res = await getX2Y2Interceptor(baseUrl).get(
      `/v1/orders?maker=${maker}&contract=${contract}&token_id=${token}&sort=created_at&direction=desc`,
    )
    if (res.status === 200 && res.data) {
      return res.data?.data?.[0]
    }
  } catch (err) {
    logger.error(`Error in retrieveOrderX2Y2: ${err}`)
  }
  return null
}
/**
 * Returns true if the listing succeeded, false otherwise.
 * @param order  x2y2 order
 * @param chainId
 */
export const createX2Y2Listing = async (
  order: string,
  maker: string,
  contract: string,
  tokenId: string,
  chainId: string,
): Promise<Partial<entity.TxOrder> | null | Error> => {
  let x2y2Order: Partial<entity.TxOrder>
  const baseUrl = chainId === '1' ? X2Y2_API_BASE_URL : X2Y2_API_TESTNET_BASE_URL
  try {
    const res = await getX2Y2Interceptor(baseUrl).post('/api/orders/add', JSON.parse(order))
    // give x2y2 time to propagate order
    await delay(10000)
    const retrievedOrder: X2Y2Order = await retriveOrderX2Y2(maker, contract, tokenId, chainId)
    if (res.status === 200 && retrievedOrder) {
      x2y2Order = await orderEntityBuilder(
        defs.ProtocolType.X2Y2,
        defs.ActivityType.Listing,
        retrievedOrder,
        chainId,
        contract,
      )
      return x2y2Order
    }
    return null
  } catch (err) {
    logger.error(`Error in createX2Y2Listing: ${err}`)
    logger.log(`createX2Y2 payload ${order}`)
    if (err?.response?.data) {
      throw JSON.stringify(err?.response?.data)
    }
    // Sentry.captureMessage(`Error in createLooksrareListing: ${err}`)
    throw JSON.stringify(err)
  }
}
