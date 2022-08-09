import axios, { AxiosError, AxiosInstance, AxiosResponse } from 'axios'
import axiosRetry, { IAxiosRetryConfig } from 'axios-retry'

import { getChain } from '@nftcom/gql/config'
import { gql } from '@nftcom/gql/defs'
import { cache } from '@nftcom/gql/service/cache.service'
import { delay } from '@nftcom/gql/service/core.service'
import { orderEntityBuilder } from '@nftcom/gql/service/txActivity.service'
import { TxOrder } from '@nftcom/shared/db/entity'
import { ActivityType, Chain, ProtocolType } from '@nftcom/shared/defs'

const OPENSEA_API_KEY = process.env.OPENSEA_API_KEY
const V1_OPENSEA_API_TESTNET_BASE_URL = 'https://testnets-api.opensea.io/api/v1'
const V1_OPENSEA_API_BASE_URL = 'https://api.opensea.io/api/v1'
const OPENSEA_API_TESTNET_BASE_URL = 'https://testnets-api.opensea.io/v2'
const OPENSEA_API_BASE_URL = 'https://api.opensea.io/v2'
// const OPENSEA_TESTNET_WYVERIN_API_BASE_URL = 'https://testnets-api.opensea.io/wyvern/v1'
// const OPENSEA_WYVERIN_API_BASE_URL = 'https://api.opensea.io/wyvern/v1'

const LIMIT = 50
const OPENSEA_LISTING_BATCH_SIZE = 30
const DELAY_AFTER_BATCH_RUN = 4
const MAX_QUERY_LENGTH = 4014 // 4094 - 80
const TESTNET_CHAIN_IDS = ['4', '5']

interface OpenseaAsset {
  image_url: string
  image_preview_url: string
  image_thumbnail_url: string
  name: string
  description: string
  asset_contract: {
    address: string
    name: string
    symbol: string
    image_url: string
    default_to_fiat: boolean
    dev_buyer_fee_basis_points: number
    dev_seller_fee_basis_points: number
    only_proxied_transfers: boolean
    opensea_buyer_fee_basis_points: number
    opensea_seller_fee_basis_points: number
    buyer_fee_basis_points: number
    seller_fee_basis_points: number
    payout_address: string
  }
  permalink: string
  collection: {
    banner_image_url: string
  }
  decimals: number
}

interface OpenseaResponseV1 {
  expiration_time: number
  created_date: string
  current_price: string
  payment_token_contract: {
    symbol: string
    address: string
    image_url: string
    name: string
    decimals: number
    eth_price: string
    usd_price: string
  }
  maker: any
  taker: any
}

interface OpenseaResponse {
  expiration_time: number
  created_date: string
  current_price: string
  maker: any
  maker_asset_bundle: {
    assets: Array<OpenseaAsset>
  }
  taker: any
  taker_asset_bundle: {
    assets: Array<OpenseaAsset>
  }
}

interface OpenseaOrderResponse {
  listings: {
    v1: Array<OpenseaResponseV1>
    seaport: Array<OpenseaResponse>
  }
  offers: {
    v1: Array<OpenseaResponseV1>
    seaport: Array<OpenseaResponse>
  }
  prices: any
}

enum OpenseaQueryParamType {
  TOKEN_IDS = 'token_ids',
  ASSET_CONTRACT_ADDRESSES = 'asset_contract_addresses',
  ASSET_CONTRACT_ADDRESS = 'asset_contract_address'
}

interface OpenseaBaseOrder {
  created_date: string
  closing_date: string
  closing_extendable: boolean
  expiration_time: number
  listing_time: number
  order_hash: string
  current_price: string
  maker: any
  taker: any
  cancelled: boolean
  finalized: boolean
  marked_invalid: boolean
  approved_on_chain?: boolean
}

export interface WyvernOrder extends OpenseaBaseOrder {
  payment_token_contract: {
    symbol: string
    address: string
    image_url: string
    name: string
    decimals: number
    eth_price: string
    usd_price: string
  }
  metadata: any
  exchange: string
  current_bounty: string
  bounty_multiple: string
  maker_relayer_fee: string
  taker_relayer_fee: string
  maker_protocol_fee: string
  taker_protocol_fee: string
  maker_referrer_fee: string
  fee_recipient: any
  fee_method: number
  side: number
  sale_kind: number
  target: string
  how_to_call: number
  calldata: string
  replacement_pattern: string
  static_target: string
  static_extradata: string
  payment_token: string
  base_price: string
  extra: string
  quantity: string
  salt: string
  v: number
  r: string
  s: string
  prefixed_hash: string
}

export interface SeaportOrder extends OpenseaBaseOrder {
  protocol_data: {
    parameters: {
      offerer: string
      offer: any
      consideration: any
      startTime: string
      endTime: string
      orderType: number
      zone: string
      zoneHash: string
      salt: string
      conduitKey: string
      totalOriginalConsiderationItems: number
      counter: number
    }
    signature: string
  }
  protocol_address: string
  maker_fees: any
  taker_fees: any
  side: string
  order_type: string
  client_signature: string
  relay_id: string
  criteria_proof: any
}

export interface OpenseaExternalOrder {
  listings: TxOrder[]
  offers: TxOrder[]
}

const cids = (): string => {
  const ids = [
    'ethereum',
    'usd-coin',
    'ape',
    'dai',
    'the-sandbox',
  ]

  return ids.join('%2C')
}

export interface OpenseaOrderRequest {
  contract: string
  tokenId: string
  chainId: string
}

/**
 * Retrieve sell or buy orders
 * if buyOrSell is 0, it returns buy orders and else if it is 1, it returns sell orders
 * @param contract
 * @param tokenId
 * @param chainId
 */
export const retrieveOrdersOpensea = async (
  contract: string,
  tokenId: string,
  chainId: string,
): Promise<OpenseaOrderResponse | undefined> => {
  if (chainId !== '4' && chainId !== '1') return undefined
  let listingUrl, offerUrl
  const baseCoinGeckoUrl = 'https://api.coingecko.com/api/v3/simple/price'
  const baseUrlV1 = chainId === '4' ? V1_OPENSEA_API_TESTNET_BASE_URL : V1_OPENSEA_API_BASE_URL
  const baseUrlV2 = chainId === '4' ? OPENSEA_API_TESTNET_BASE_URL : OPENSEA_API_BASE_URL
  const config = chainId === '4' ? {
    headers: { Accept: 'application/json' },
  } :  {
    headers: {
      Accept: 'application/json',
      'X-API-KEY': OPENSEA_API_KEY,
    },
  }
  try {
    const responses: OpenseaOrderResponse = {
      listings: {
        v1: [],
        seaport: [],
      },
      offers: {
        v1: [],
        seaport: [],
      },
      prices: {},
    }

    // Get Listings
    listingUrl = `${baseUrlV1}/asset/${contract}/${tokenId}/listings?limit=50`

    const res = await axios.get(listingUrl, config)
    if (res && res.data) {
      const listings = res.data.listings as Array<OpenseaResponseV1>
      if (listings) responses.listings.v1.push(...listings)

      // eslint-disable-next-line no-constant-condition
      while (true) {
        listingUrl = `${baseUrlV2}/orders/ethereum/seaport/listings?asset_contract_address=${contract}&limit=50&token_ids=${tokenId}`

        const res = await axios.get(listingUrl, config)
        if (res && res.data && res.data.orders) {
          const orders = res.data.orders as Array<OpenseaResponse>
          responses.listings.seaport.push(...orders)
          if (orders.length < LIMIT) {
            break
          } else {
            listingUrl = res.data.next
            await delay(1000)
          }
        }
      }
    }

    // Get Offers
    offerUrl = `${baseUrlV1}/asset/${contract}/${tokenId}/offers?limit=50`
    const res2 = await axios.get(offerUrl, config)
    if (res2 && res2.data) {
      const orders = res2.data.offers as Array<OpenseaResponseV1>
      if (orders) responses.offers.v1.push(...orders)

      // eslint-disable-next-line no-constant-condition
      while (true) {
        // seaport
        offerUrl = `${baseUrlV2}/orders/ethereum/seaport/offers?asset_contract_address=${contract}&limit=50&token_ids=${tokenId}`
        const res2 = await axios.get(offerUrl, config)
        if (res2 && res2.data && res2.data.orders) {
          const orders = res2.data.orders as Array<OpenseaResponse>
          responses.offers.seaport.push(...orders)
          if (orders.length < LIMIT) {
            break
          } else {
            offerUrl = res2.data.next
            await delay(1000)
          }
        }
      }
    }

    const coinGeckoPriceUrl = `${baseCoinGeckoUrl}?ids=${cids()}&vs_currencies=usd`

    const cachedPrice = await cache.get(coinGeckoPriceUrl)
    if (cachedPrice) {
      responses.prices = JSON.parse(cachedPrice)
    } else {
      const res3 = await axios.get(coinGeckoPriceUrl)
      responses.prices = res3.data
      await cache.set(coinGeckoPriceUrl, JSON.stringify(res3.data), 'EX', 60 * 10) // 10 minute
    }

    return responses
  } catch (err) {
    // Sentry.captureMessage(`Error in retrieveOrdersOpensea: ${err}`)
    return undefined
  }
}

export const retrieveCollectionOpensea = async (
  contract: string,
  chainId: string,
) : Promise<gql.OpenseaContract> => {
  try {
    const baseUrl = chainId === '4' ? V1_OPENSEA_API_TESTNET_BASE_URL : V1_OPENSEA_API_BASE_URL

    const config = chainId === '4' ? {
      headers: { Accept: 'application/json' },
    } :  {
      headers: {
        Accept: 'application/json',
        'X-API-KEY': OPENSEA_API_KEY,
      },
    }

    const url = `${baseUrl}/asset_contract/${contract}`
    const res = await axios.get(url, config)
    return res.data
  } catch (err) {
    // Sentry.captureMessage(`Error in retrieveCollectionOpensea: ${err}`)
    return undefined
  }
}

export const retrieveCollectionStatsOpensea = async (
  slug: string,
  chainId: string,
) : Promise<gql.OpenseaStats> => {
  try {
    const baseUrl = chainId === '4' ? V1_OPENSEA_API_TESTNET_BASE_URL : V1_OPENSEA_API_BASE_URL

    const config = chainId === '4' ? {
      headers: { Accept: 'application/json' },
    } :  {
      headers: {
        Accept: 'application/json',
        'X-API-KEY': OPENSEA_API_KEY,
      },
    }

    const url = `${baseUrl}/collection/${slug}/stats`
    const res = await axios.get(url, config)
    return res.data
  } catch (err) {
    // Sentry.captureMessage(`Error in retrieveCollectionStatsOpensea: ${err}`)
    return undefined
  }
}

export const retrieveOffersOpensea = async (
  contract: string,
  tokenId: string,
  chainId: string,
): Promise<Array<OpenseaResponse> | undefined> => {
  let url
  let config
  if (chainId === '4') {
    return []
  } else {
    url = `https://api.opensea.io/api/v1/asset/${contract}/${tokenId}/offers?limit=50`
    config = {
      headers: {
        Accept: 'application/json',
        'X-API-KEY': OPENSEA_API_KEY,
      },
    }
    try {
      const result = await axios.get(url, config)
      const offers = result.data.offers as Array<OpenseaResponse>
      return offers
    } catch (err) {
      // Sentry.captureMessage(`Error in retrieveOffersOpensea: ${err}`)
      return undefined
    }
  }
}

const getOpenseaInterceptor = (
  baseURL: string,
  chainId: string,
): AxiosInstance => {
  const openseaInstance = axios.create({
    baseURL,
    headers: {
      'Accept': 'application/json',
      'X-API-KEY': chainId === '1'? OPENSEA_API_KEY : '',
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
  axiosRetry(openseaInstance,  retryOptions)

  return openseaInstance
}

/**
 * Retrieve listings in batches
 * @param listingQueryParams
 * @param chainId
 * @param batchSize
 */
const retrieveListingsInBatches = async (
  listingQueryParams: string[],
  chainId: string,
  batchSize: number,
): Promise<any[]> => {
  const listings: any[] = []
  let batch: string[], queryUrl: string
  const listingBaseUrl: string =  TESTNET_CHAIN_IDS.includes(chainId) ?
    V1_OPENSEA_API_TESTNET_BASE_URL
    : V1_OPENSEA_API_BASE_URL
  const listingInterceptor = getOpenseaInterceptor(
    listingBaseUrl,
    chainId,
  )

  let delayCounter = 0
  let size: number
  while(listingQueryParams.length) {
    size = batchSize
    batch = listingQueryParams.slice(0, size) // batches of 200

    queryUrl = `${batch.join('&')}`

    // only executed if query length more than accepted limit by opensea
    // runs once or twice at most
    while(queryUrl.length > MAX_QUERY_LENGTH) {
      size--
      batch = listingQueryParams.slice(0, size)
      queryUrl = `${batch.join('&')}`
    }

    const response: AxiosResponse = await listingInterceptor(
      `/assets?${queryUrl}&limit=${batchSize}&include_orders=true`,
    )
    if (response?.data?.assets?.length) {
      const assets = response?.data?.assets
      if (assets?.length) {
        for (const asset of assets) {
          const seaportOrders: SeaportOrder[] | null =  asset?.seaport_sell_orders
          // seaport orders - always returns cheapest order
          if (seaportOrders && Object.keys(seaportOrders?.[0]).length) {
            listings.push(
              orderEntityBuilder(
                ProtocolType.Seaport,
                ActivityType.Listing,
                seaportOrders?.[0] as any,
                chainId,
              ),
            )
          }
        }
      }
    }
    listingQueryParams = [...listingQueryParams.slice(size)]
    delayCounter++
    if (delayCounter === DELAY_AFTER_BATCH_RUN) {
      await delay(1000)
      delayCounter = 0
    }
  }
        
  return await Promise.all(listings)
}

/**
 * Retrieve offers in batches
 * @param offerQueryParams
 * @param chainId
 * @param batchSize
 */
const retrieveOffersInBatches = async (
  offerQueryParams: Map<string, string[]>,
  chainId: string,
  batchSize: number,
): Promise<any[]> => {
  let batch: string[], queryUrl: string
  const offers: any[] = []

  const offerBaseUrl: string =  TESTNET_CHAIN_IDS.includes(chainId) ?
    OPENSEA_API_TESTNET_BASE_URL
    : OPENSEA_API_BASE_URL

  const offerInterceptor = getOpenseaInterceptor(
    offerBaseUrl,
    chainId,
  )

  let delayCounter = 0
  let size: number
  let seaportOffers: SeaportOrder[]

  // contracts exist
  if (offerQueryParams.size) {
    // iterate  on contract
    for (const contract of offerQueryParams.keys()) {
      // contract has tokens
      if (offerQueryParams.get(contract).length) {
        // batches of batchSize tokens
        let tokens: string[] = offerQueryParams.get(contract)
        while (tokens.length) {
          size = batchSize
          batch = tokens.slice(0, size)
          queryUrl = `asset_contract_address=${contract}&${batch.join('&')}`

          // only executed if query length more than accepted limit by opensea
          // runs once or twice at most
          while(queryUrl.length > MAX_QUERY_LENGTH) {
            size--
            batch = tokens.slice(0, size)
            queryUrl = `asset_contract_address=${contract}&${batch.join('&')}`
          }

          const openseaSupportedChainId:string = TESTNET_CHAIN_IDS.includes(chainId)? '4':chainId
          const chain:Chain =  getChain('ethereum',openseaSupportedChainId)
          const response: AxiosResponse = await offerInterceptor(
            `/orders/${chain.name}/seaport/offers?${queryUrl}&limit=${batchSize}&order_direction=desc&order_by=eth_price`,
          )
      
          if (response?.data?.orders?.length) {
            seaportOffers = response?.data?.orders
            offers.push(
              orderEntityBuilder(
                ProtocolType.Seaport,
                ActivityType.Bid,
                seaportOffers?.[0] as any,
                chainId,
              ),
            )
          }
        
          tokens = [...tokens.slice(size)]
          delayCounter++
          // add delay
          if (delayCounter === DELAY_AFTER_BATCH_RUN) {
            await delay(1000)
            delayCounter = 0
          }
        }
      }
    }
  }
  return await Promise.all(offers)
}

/**
 * Retrieve multiple sell or buy orders
 * TODO: Offer implementation in the offer ticket
 * @param openseaMultiOrderRequest
 * @param chainId
 * @param includeOffers
 */
export const retrieveMultipleOrdersOpensea = async (
  openseaMultiOrderRequest: Array<OpenseaOrderRequest>,
  chainId: string,
  includeOffers: boolean,
): Promise<OpenseaExternalOrder> => {
  const responseAggregator: OpenseaExternalOrder = {
    listings: [],
    offers: [],
  }

  try {
    if (openseaMultiOrderRequest?.length) {
      const listingQueryParams: Array<string> = []
      const offerQueryParams: Map<string, Array<string>> = new Map()
      for (const openseaReq of openseaMultiOrderRequest) {
        // listing query builder
        listingQueryParams.push(
          `${OpenseaQueryParamType.ASSET_CONTRACT_ADDRESSES}=${openseaReq.contract}&${OpenseaQueryParamType.TOKEN_IDS}=${openseaReq.tokenId}`,
        )

        if (includeOffers) {
          // offer query builder
          if (!offerQueryParams.has(openseaReq.contract)) {
            offerQueryParams.set(openseaReq.contract,
              [],
            )
          }
          offerQueryParams.get(openseaReq.contract)?.push(
            `${OpenseaQueryParamType.TOKEN_IDS}=${openseaReq.tokenId}`,
          )
        }
      }

      // listings 
      if (listingQueryParams.length) {
        responseAggregator.listings = await retrieveListingsInBatches(
          listingQueryParams,
          chainId,
          OPENSEA_LISTING_BATCH_SIZE,
        )
      }

      // offers
      if (includeOffers && offerQueryParams.size) {
        responseAggregator.offers = await retrieveOffersInBatches(
          offerQueryParams,
          chainId,
          OPENSEA_LISTING_BATCH_SIZE,
        )
      }
    }
  } catch (err) {
    // Sentry.captureMessage(`Error in retrieveOrdersOpensea: ${err}`)
  }
  return responseAggregator
}
