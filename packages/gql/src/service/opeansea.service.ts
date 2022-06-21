import axios from 'axios'
import Redis from 'ioredis'

import { redisConfig } from '@nftcom/gql/config'
import { delay } from '@nftcom/gql/service/core.service'
import * as Sentry from '@sentry/node'
const OPENSEA_API_KEY = process.env.OPENSEA_API_KEY
const OPENSEA_API_TESTNET_BASE_URL = 'https://testnets-api.opensea.io/v2'
const OPENSEA_API_BASE_URL = 'https://api.opensea.io/v2'
const LIMIT = 50

const redis = new Redis({
  host: redisConfig.host,
  port: redisConfig.port,
})

interface OpenseaAsset {
  image_url: string
  image_preview_url: string
  image_thumbnail_url: string
  name: string
  description: string
  asset_contract: {
    address: string
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

export interface OpenseaOrderResponse {
  listings: Array<OpenseaResponse>
  offers: Array<OpenseaResponse>
  prices: any
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

/**
 * Retrieve sell or buy orders
 * if buyOrSell is 0, it returns buy orders and else if it is 1, it returns sell orders
 * @param contract
 * @param tokenId
 * @param chainId
 * @param buyOrSell
 * @param listedBefore
 */
export const retrieveOrdersOpensea = async (
  contract: string,
  tokenId: string,
  chainId: string,
): Promise<OpenseaOrderResponse | undefined> => {
  let listingUrl, offerUrl
  const baseCoinGeckoUrl = 'https://api.coingecko.com/api/v3/simple/price'
  const baseUrl = chainId === '4' ? OPENSEA_API_TESTNET_BASE_URL : OPENSEA_API_BASE_URL
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
      listings: [],
      offers: [],
      prices: {},
    }

    // eslint-disable-next-line no-constant-condition
    while (true) {
      listingUrl = `${baseUrl}/orders/ethereum/seaport/listings?asset_contract_address=${contract}&limit=50&token_ids=${tokenId}`

      const res = await axios.get(listingUrl, config)
      if (res && res.data && res.data.orders) {
        const orders = res.data.orders as Array<OpenseaResponse>
        responses.listings.push(...orders)
        if (orders.length < LIMIT) {
          break
        } else {
          listingUrl = res.data.next
          await delay(1000)
        }
      }
    }

    // eslint-disable-next-line no-constant-condition
    while (true) {
      offerUrl = `${baseUrl}/orders/ethereum/seaport/offers?asset_contract_address=${contract}&limit=50&token_ids=${tokenId}`
      const res2 = await axios.get(offerUrl, config)
      if (res2 && res2.data && res2.data.orders) {
        const orders = res2.data.orders as Array<OpenseaResponse>
        responses.offers.push(...orders)
        if (orders.length < LIMIT) {
          break
        } else {
          offerUrl = res2.data.next
          await delay(1000)
        }
      }
    }

    const coinGeckoPriceUrl = `${baseCoinGeckoUrl}?ids=${cids()}&vs_currencies=usd`

    const cachedPrice = await redis.get(coinGeckoPriceUrl)
    if (cachedPrice) {
      responses.prices = JSON.parse(cachedPrice)
    } else {
      const res3 = await axios.get(coinGeckoPriceUrl)
      responses.prices = res3.data
      redis.set(coinGeckoPriceUrl, JSON.stringify(res3.data), 'EX', 60) // 1 minute
    }

    return responses
  } catch (err) {
    Sentry.captureException(err)
    Sentry.captureMessage(`Error in retrieveOrdersOpensea: ${err}`)
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
      Sentry.captureException(err)
      Sentry.captureMessage(`Error in retrieveOffersOpensea: ${err}`)
      return undefined
    }
  }
}
