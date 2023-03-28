/* eslint-disable no-magic-numbers */
import axios, { AxiosError, AxiosInstance, AxiosResponse } from 'axios'
import axiosRetry, { IAxiosRetryConfig } from 'axios-retry'
import { Maybe } from 'graphql/jsutils/Maybe'

import { delay } from '@nftcom/gql/service/core.service'
import { orderEntityBuilder } from '@nftcom/gql/service/txActivity.service'
import { _logger,defs,entity } from '@nftcom/shared'

const OPENSEA_API_KEY = process.env.OPENSEA_API_KEY
const OPENSEA_ORDERS_API_KEY = process.env.OPENSEA_ORDERS_API_KEY
const V1_OPENSEA_API_TESTNET_BASE_URL = 'https://testnets-api.opensea.io/api/v1'
const V1_OPENSEA_API_BASE_URL = 'https://api.opensea.io/api/v1'
const OPENSEA_API_TESTNET_BASE_URL = 'https://testnets-api.opensea.io/v2'
const OPENSEA_API_BASE_URL = 'https://api.opensea.io/v2'
// const OPENSEA_TESTNET_WYVERIN_API_BASE_URL = 'https://testnets-api.opensea.io/wyvern/v1'
// const OPENSEA_WYVERIN_API_BASE_URL = 'https://api.opensea.io/wyvern/v1'

const OPENSEA_POST_DELAY = 500
const OPENSEA_LISTING_BATCH_SIZE = 30
const DELAY_AFTER_BATCH_RUN = 4
const MAX_QUERY_LENGTH = 4014 // 4094 - 80
const TESTNET_CHAIN_IDS = ['4', '5']

const logger = _logger.Factory(_logger.Context.Opensea)

enum OpenseaQueryParamType {
  TOKEN_IDS = 'token_ids',
  ASSET_CONTRACT_ADDRESSES = 'asset_contract_addresses',
  ASSET_CONTRACT_ADDRESS = 'asset_contract_address'
}

interface MakerOrTaker {
  address: string
}
interface OpenseaBaseOrder {
  created_date: string
  closing_date: string
  closing_extendable?: boolean
  expiration_time: number
  listing_time: number
  order_hash: string
  current_price: string
  maker: MakerOrTaker
  taker: MakerOrTaker
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

interface MakerOrTakerFees {
  account: {
    address: string
  }
  basis_points: string
}

export interface SeaportOffer {
  itemType: number
  token: string
  identifierOrCriteria: string
  startAmount: string
  endAmount: string

}

export interface SeaportConsideration extends SeaportOffer {
  recipient: string
}

export interface SeaportOrder extends OpenseaBaseOrder {
  protocol_data: {
    parameters: {
      offerer: string
      offer: SeaportOffer[]
      consideration: SeaportConsideration[]
      startTime: string
      endTime: string
      orderType: number
      zone: string
      zoneHash: string
      salt: string
      conduitKey: string
      totalOriginalConsiderationItems: number
      counter: number | string // part of seaport 1.4 upgrade -> new counters will be strings and old counters will be numbers
    }
    signature: string
  }
  protocol_address: string
  maker_fees: MakerOrTakerFees[]
  taker_fees: MakerOrTakerFees[] | null
  side: string
  order_type: string
  client_signature: string
  relay_id: string
  criteria_proof: any
}

export interface OpenseaExternalOrder {
  listings: entity.TxOrder[]
  offers: entity.TxOrder[]
}

export interface ListingPayload {
  listing: {
    hash: string
    chain: string
    protocol_address: string
  }
  fulfiller: {
    address: string
  }
}

interface AdditionalRecipient {
  amount: number
  recipient: string
}

interface Asset {
  itemType: number
  token: string
  identifierOrCriteria: string
  startAmount: string
  endAmount: string
}

interface Consideration {
  itemType: number
  token: string
  identifierOrCriteria: string
  startAmount: string
  endAmount: string
  recipient: string
}

interface OrderParameters {
  offerer: string
  offer: Asset[]
  consideration: Consideration[]
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

interface Order {
  parameters: OrderParameters
  signature: string
}

export interface FulfillmentData {
  fulfillment_data: {
    transaction: {
      function: string
      chain: number
      to: string
      value: number
      input_data: {
        parameters: {
          considerationToken: string
          considerationIdentifier: number
          considerationAmount: number
          offerer: string
          zone: string
          offerToken: string
          offerIdentifier: number
          offerAmount: number
          basicOrderType: number
          startTime: number
          endTime: number
          zoneHash: string
          salt: number
          offererConduitKey: string
          fulfillerConduitKey: string
          totalOriginalAdditionalRecipients: number
          additionalRecipients: AdditionalRecipient[]
          signature: string
        }
      }
    }
    orders: Order[]
  }
}

// commented for future reference
// const cids = (): string => {
//   const ids = [
//     'ethereum',
//     'usd-coin',
//     'ape',
//     'dai',
//     'the-sandbox',
//   ]

//   return ids.join('%2C')
// }

export interface OpenseaOrderRequest {
  contract: string
  tokenId: string
  chainId: string
}

const getOpenseaInterceptor = (
  baseURL: string,
  chainId: string,
  apiKey?: string,
): AxiosInstance => {
  const apiKeyApplied: string = apiKey ? apiKey : OPENSEA_API_KEY
  const openseaInstance = axios.create({
    baseURL,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-API-KEY': chainId === '1'? apiKeyApplied : '',
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
  axiosRetry(openseaInstance as any,  retryOptions)

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
          const contract: string = asset?.asset_contract?.address
          const seaportOrders: SeaportOrder[] | null =  asset?.seaport_sell_orders
          // seaport orders - always returns cheapest order
          if (seaportOrders && Object.keys(seaportOrders?.[0]).length) {
            listings.push(
              orderEntityBuilder(
                defs.ProtocolType.Seaport,
                defs.ActivityType.Listing,
                seaportOrders?.[0],
                chainId,
                contract,
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
 * Fulfill listings by sending POST requests to the OpenSea API.
 * @param payloads An array of payloads to be sent in the POST requests.
 * @param chainId The chainId to be used for selecting the appropriate API key and base URL.
 * @param apiKey Optional custom API key. If not provided, the default API key will be used.
 * @returns A Promise that resolves to an array of responses received from the OpenSea API.
 */
export const postListingFulfillments = async (
  payloads: ListingPayload[],
  chainId: string,
): Promise<FulfillmentData[]> => {
  const fulfillmentResponses: FulfillmentData[] = []

  // listingBaseUrl is V2
  const listingBaseUrl: string = TESTNET_CHAIN_IDS.includes(chainId)
    ? OPENSEA_API_TESTNET_BASE_URL
    : OPENSEA_API_BASE_URL
  const listingInterceptor = getOpenseaInterceptor(listingBaseUrl, chainId)

  for (let i = 0; i < payloads.length; i++) {
    const payload = payloads[i]
    const response: AxiosResponse = await listingInterceptor.post(
      '/listings/fulfillment_data',
      payload,
      {
        headers: {
          'content-type': 'application/json',
        },
      },
    )

    fulfillmentResponses.push(response.data)

    // Throttle requests to 2 per second by waiting 500ms between each request
    if (i < payloads.length - 1) {
      await delay(OPENSEA_POST_DELAY)
    }
  }

  return fulfillmentResponses
}

/**
 * Retrieve offers in batches
 * @param offerQueryParams
 * @param chainId
 * @param batchSize
 * @param createdInternally,
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

          const response: AxiosResponse = await offerInterceptor(
            `/orders/${chainId === '1' ? 'ethereum': chainId === '5' ? 'goerli' : 'goerli'}/seaport/offers?${queryUrl}&limit=${batchSize}&order_direction=desc&order_by=eth_price`,
          )

          if (response?.data?.orders?.length) {
            seaportOffers = response?.data?.orders
            offers.push(
              orderEntityBuilder(
                defs.ProtocolType.Seaport,
                defs.ActivityType.Bid,
                seaportOffers?.[0],
                chainId,
                contract,
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
    logger.error(`Error in retrieveMultipleOrdersOpensea: ${err}`)
    // Sentry.captureMessage(`Error in retrieveOrdersOpensea: ${err}`)
  }
  return responseAggregator
}

/**
 * Returns true if the listing succeeded, false otherwise.
 * @param signature  signature of the order for these parameters
 * @param parameters stringified JSON matching the 'parameters' field in the protocol data schema
 * @param chainId
 */
export const createSeaportListing = async (
  signature: Maybe<string>,
  parameters: Maybe<string>,
  chainId: string,
): Promise<Partial<entity.TxOrder> | null| Error> => {
  let openseaOrder: Partial<entity.TxOrder>
  const baseUrlV2 = chainId === '1' ? OPENSEA_API_BASE_URL : OPENSEA_API_TESTNET_BASE_URL
  if (
    signature == null || signature.length === 0 ||
    parameters == null || parameters.length === 0
  ) {
    return null
  }
  try {
    const res = await getOpenseaInterceptor(baseUrlV2, chainId, OPENSEA_ORDERS_API_KEY).post(
      `/orders/${chainId === '1' ? 'ethereum': 'goerli'}/seaport/listings`,
      {
        signature,
        parameters: JSON.parse(parameters),
      })

    if (res.status === 200 && res.data.order) {
      const contract: string = JSON.parse(parameters)?.offer?.[0]?.token
      openseaOrder = await orderEntityBuilder(
        defs.ProtocolType.Seaport,
        defs.ActivityType.Listing,
        res.data.order,
        chainId,
        contract,
      )
      return openseaOrder
    }
    return null
  } catch (err) {
    logger.error(`Error in createSeaportListing: ${err}`)
    logger.log(`seaport signature ${signature}`)
    logger.log(`createSeaportListing payload ${parameters}`)
    if (err?.response?.data) {
      throw JSON.stringify(err?.response?.data)
    }
    throw JSON.stringify(err)
  }
}

