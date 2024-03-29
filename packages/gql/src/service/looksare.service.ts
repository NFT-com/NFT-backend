import axios, { AxiosError, AxiosInstance, AxiosResponse } from 'axios'
import axiosRetry, { IAxiosRetryConfig } from 'axios-retry'

import { delay } from '@nftcom/gql/service/core.service'
import { orderEntityBuilder } from '@nftcom/gql/service/txActivity.service'
import { _logger, defs, entity } from '@nftcom/shared'

const LOOKSRARE_API_BASE_URL = 'https://api.looksrare.org/api/v2'
const LOOKSRARE_API_TESTNET_BASE_URL = 'https://api-goerli.looksrare.org/api/v2'
const LOOKSRARE_LISTING_BATCH_SIZE = 4
const LOOKSRARE_API_KEY = process.env.LOOKSRARE_API_KEY

const logger = _logger.Factory(_logger.Context.Looksrare)
export interface LooksRareOrderRequest {
  contract: string
  tokenId: string
  chainId: string
}

export interface LooksRareOrder {
  hash: string
  collectionAddress: string
  tokenId: string
  isOrderAsk: boolean
  signer: string
  strategy: string
  currencyAddress: string
  amount: number
  price: string
  nonce: string
  startTime: number
  endTime: number
  minPercentageToAsk: number
  params: string
  status: string
  signature: string
  v: number
  r: string
  s: string
}

export interface LooksRareOrderV2 {
  id: string
  hash: string
  quoteType: number
  globalNonce: string
  subsetNonce: string
  orderNonce: string
  collection: string
  currency: string
  signer: string
  strategyId: number
  collectionType: number
  startTime: number
  endTime: number
  price: string
  additionalParameters: string
  signature: string
  createdAt: string
  merkleRoot: string
  merkleProof: {
    position: number
    value: string
  }[]
  amounts: string[]
  itemIds: string[]
  status: string
}

export interface LooksrareExternalOrder {
  listings: entity.TxOrder[]
  offers: entity.TxOrder[]
}

export interface LookrareResponse {
  collectionAddress: string
  tokenId: string
  isOrderAsk: boolean // if isOrderAsk is true, it's listing, or else it's offer
  currencyAddress: string
  price: string
  startTime: number
  endTime: number
  status: string
}

const getLooksRareInterceptor = (baseURL: string, chainId: string): AxiosInstance => {
  const looksrareInstance = axios.create({
    baseURL,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Looks-Api-Key': chainId === '1' ? LOOKSRARE_API_KEY : '',
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
  axiosRetry(looksrareInstance as any, retryOptions)
  return looksrareInstance
}

/**
 * Retrieve listings in batches
 * @param listingQueryParams
 * @param chainId
 * @param batchSize
 */
const retrieveLooksRareOrdersInBatches = async (
  listingQueryParams: string[],
  chainId: string,
  batchSize: number,
): Promise<LooksrareExternalOrder> => {
  const listings: any[] = []
  const offers: any[] = []
  let queryUrl
  const listingBaseUrl = chainId === '5' ? LOOKSRARE_API_TESTNET_BASE_URL : LOOKSRARE_API_BASE_URL
  const listingInterceptorLooksrare = getLooksRareInterceptor(listingBaseUrl, chainId)
  let delayCounter = 0
  let size: number
  while (listingQueryParams.length > 0) {
    size = batchSize
    queryUrl = listingQueryParams.pop()

    const response: AxiosResponse = await listingInterceptorLooksrare(`/orders?${queryUrl}`)

    if (response?.data?.data?.length) {
      const orders = response?.data?.data
      if (queryUrl.includes('quoteType=1')) {
        listings.push(
          orderEntityBuilder(
            defs.ProtocolType.LooksRareV2,
            defs.ActivityType.Listing,
            orders[0],
            chainId,
            orders[0]?.collection,
          ),
        )
      } else {
        offers.push(
          orderEntityBuilder(
            defs.ProtocolType.LooksRareV2,
            defs.ActivityType.Bid,
            orders?.[0],
            chainId,
            orders[0]?.collection,
          ),
        )
      }
    }
    delayCounter = delayCounter + 1
    if (delayCounter === size) {
      await delay(1000)
      delayCounter = 0
    }
  }

  return {
    listings: await Promise.all(listings),
    offers: await Promise.all(offers),
  }
}

/**
 * Retrieve multiple sell or buy orders
 * @param looksrareMultiOrderRequest
 * @param chainId
 * @param includeOffers
 */
export const retrieveMultipleOrdersLooksrare = async (
  looksrareMultiOrderRequest: Array<LooksRareOrderRequest>,
  chainId: string,
  includeOffers: boolean,
): Promise<LooksrareExternalOrder> => {
  let responseAggregator: LooksrareExternalOrder = {
    listings: [],
    offers: [],
  }

  try {
    if (looksrareMultiOrderRequest?.length) {
      const orderQueries: Array<string> = []
      for (const looksrareReq of looksrareMultiOrderRequest) {
        orderQueries.push(
          `quoteType=1&collection=${looksrareReq.contract}&itemId=${looksrareReq.tokenId}&status=VALID&sort=PRICE_ASC`,
        )
        if (includeOffers) {
          orderQueries.push(
            `quoteType=0&collection=${looksrareReq.contract}&itemId=${looksrareReq.tokenId}&status=VALID&sort=PRICE_DESC`,
          )
        }
      }
      if (orderQueries.length) {
        responseAggregator = await retrieveLooksRareOrdersInBatches(orderQueries, chainId, LOOKSRARE_LISTING_BATCH_SIZE)
      }
    }
  } catch (err) {
    logger.error(`Error in retrieveMultipleOrdersLooksrare: ${err}`)
    // Sentry.captureMessage(`Error in retrieveOrdersLooksrare: ${err}`)
  }
  return responseAggregator
}

/**
 * Returns true if the listing succeeded, false otherwise.
 * @param order  stringified JSON matching the LooksRareOrder type
 * @param chainId
 */
export const createLooksrareListing = async (
  order: string,
  chainId: string,
): Promise<Partial<entity.TxOrder> | null | Error> => {
  let looksrareOrder: Partial<entity.TxOrder>
  const baseUrl = chainId === '4' ? LOOKSRARE_API_TESTNET_BASE_URL : LOOKSRARE_API_BASE_URL
  if (order == null || order.length === 0) {
    return null
  }
  try {
    const res = await getLooksRareInterceptor(baseUrl, chainId).post('/orders', JSON.parse(order))
    if (res.status === 201 && res.data.data) {
      looksrareOrder = await orderEntityBuilder(
        defs.ProtocolType.LooksRareV2,
        defs.ActivityType.Listing,
        res.data.data,
        chainId,
        res.data.data.collection,
      )
      return looksrareOrder
    }
    return null
  } catch (err) {
    logger.error(`Error in createLooksrareListing: ${err}`)
    logger.log(`createLooksrare payload ${order}`)
    if (err?.response?.data) {
      throw JSON.stringify(err?.response?.data)
    }
    // Sentry.captureMessage(`Error in createLooksrareListing: ${err}`)
    throw JSON.stringify(err)
  }
}
