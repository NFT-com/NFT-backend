import axios, { AxiosError, AxiosInstance, AxiosResponse } from 'axios'
import axiosRetry, { IAxiosRetryConfig } from 'axios-retry'

import { delay } from '@nftcom/gql/service/core.service'
import { TxOrder } from '@nftcom/shared/db/entity'
import { ActivityType, ProtocolType } from '@nftcom/shared/defs'

import { orderEntityBuilder } from './txActivity.service'

const LOOKSRARE_API_BASE_URL = 'https://api.looksrare.org/api/v1'
const LOOKSRARE_API_TESTNET_BASE_URL = 'https://api-rinkeby.looksrare.org/api/v1'
const LOOKSRARE_LISTING_BATCH_SIZE = 4
const LOOKSRARE_API_KEY = process.env.LOOKSRARE_API_KEY

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
  price:number
  nonce: string
  startTime:number
  endTime:number
  minPercentageToAsk:number
  params: string
  status: string
  signature: string
  v: number
  r: string
  s: string
}

export interface LooksrareExternalOrder {
  listings: TxOrder[]
  offers: TxOrder[]
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

/**
 * Retrieve sell or buy orders
 * if isOrderAsk is true, it's listing, or else it's offer
 * @param contract
 * @param tokenId
 * @param chainId
 * @param isOrderAsk
 * @param status
 */
export const retrieveOrdersLooksrare = async (
  contract: string,
  tokenId: string,
  chainId: string,
  isOrderAsk: boolean,
  status: string,
): Promise<Array<LookrareResponse> | undefined> => {
  if (chainId !== '4' && chainId !== '1') return undefined
  let url
  const baseUrl = chainId === '4' ? LOOKSRARE_API_TESTNET_BASE_URL : LOOKSRARE_API_BASE_URL
  const config = {
    headers: { Accept: 'application/json' },
  }
  try {
    url = `${baseUrl}/orders?isOrderAsk=${isOrderAsk}&collection=${contract}&tokenId=${tokenId}&status%5B%5D=${status}&sort=PRICE_ASC`
    const res = await axios.get(url, config)
    if (res && res.data && res.data.data) {
      const orders = res.data.data as Array<LookrareResponse>
      return orders
    }
    return undefined
  } catch (err) {
    //Sentry.captureMessage(`Error in retrieveOrdersLooksrare: ${err}`)
    return undefined
  }
}

const getLooksRareInterceptor = (
  baseURL: string,
): AxiosInstance => {
  const looksrareInstance = axios.create({
    baseURL,
    headers: {
      'Accept': 'application/json',
      'X-Looks-Api-Key':LOOKSRARE_API_KEY,
    },
  })
  // retry logic with exponential backoff
  const retryOptions: IAxiosRetryConfig= { retries: 3,
    retryCondition: (err: AxiosError<any>) => {
      return (
        axiosRetry.isNetworkOrIdempotentRequestError(err) ||
        err.response.status === 429
      )
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
  axiosRetry(looksrareInstance,  retryOptions)
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
  const listingBaseUrl = chainId === '4' ? LOOKSRARE_API_TESTNET_BASE_URL : LOOKSRARE_API_BASE_URL
  const listingInterceptorLooksrare = getLooksRareInterceptor(
    listingBaseUrl,
  )
  let delayCounter = 0
  let size: number
  while(listingQueryParams.length>0) {
    size = batchSize
    queryUrl = listingQueryParams.pop()

    const response: AxiosResponse = await listingInterceptorLooksrare(
      `/orders?${queryUrl}`,
    )
    
    if (response?.data?.data?.length)
    {
      const assets = response?.data?.data
      if( queryUrl.includes('isOrderAsk=true')){
        listings.push(
          orderEntityBuilder(
            ProtocolType.LooksRare,
            ActivityType.Listing,
            assets[0],
            chainId,
          ),
        )
      }
      else  {
        offers.push(
          orderEntityBuilder(
            ProtocolType.LooksRare,
            ActivityType.Bid,
            assets[0],
            chainId,
          ),
        )
      }
    }
    delayCounter = delayCounter +1
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
        orderQueries.push(`isOrderAsk=true&collection=${looksrareReq.contract}&tokenId=${looksrareReq.tokenId}&status[]=VALID&sort=PRICE_ASC`)
        if (includeOffers) {
          orderQueries.push(`isOrderAsk=false&collection=${looksrareReq.contract}&tokenId=${looksrareReq.tokenId}&status[]=VALID&sort=PRICE_DESC`)
        }
      }
      if (orderQueries.length) {
        responseAggregator = await retrieveLooksRareOrdersInBatches(
          orderQueries,
          chainId,
          LOOKSRARE_LISTING_BATCH_SIZE,
        )
      }
    }
  } catch (err) {
    //Sentry.captureMessage(`Error in retrieveOrdersLooksrare: ${err}`)
    return undefined
  }
  return responseAggregator
}
