import axios from 'axios'

import { delay } from '@nftcom/gql/service/core.service'
import * as Sentry from '@sentry/node'
const OPENSEA_API_KEY = process.env.OPENSEA_API_KEY
const OPENSEA_API_TESTNET_BASE_URL = 'https://testnets-api.opensea.io/v2'
const OPENSEA_API_BASE_URL = 'https://api.opensea.io/v2'
const LIMIT = 50

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

export interface OpenseaResponse {
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
): Promise<Array<OpenseaResponse> | undefined> => {
  let url
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
    const responses: Array<OpenseaResponse> = []

    // eslint-disable-next-line no-constant-condition
    while (true) {
      // listings
      // https://api.opensea.io/v2/orders/ethereum/seaport/listings?asset_contract_address=0x98ca78e89Dd1aBE48A53dEe5799F24cC1A462F2D&limit=50&token_ids=8781
      url = `${baseUrl}/orders/ethereum/seaport/listings?asset_contract_address=${contract}&limit=50&token_ids=${tokenId}`

      // offers
      // https://api.opensea.io/v2/orders/ethereum/seaport/offers?asset_contract_address=0x98ca78e89Dd1aBE48A53dEe5799F24cC1A462F2D&limit=50&token_ids=8781
      
      const res = await axios.get(url, config)
      if (res && res.data && res.data.orders) {
        console.log('res.data: ', res.data)
        const orders = res.data.orders as Array<OpenseaResponse>
        responses.push(...orders)
        if (orders.length < LIMIT) {
          break
        } else {
          url = res.data.next
          await delay(1000)
        }
      }
    }
    return responses
  } catch (err) {
    console.log('error while external: ', err)
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
