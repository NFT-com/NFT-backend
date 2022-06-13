import axios from 'axios'

import { delay } from '@nftcom/gql/service/core.service'
import * as Sentry from '@sentry/node'
const OPENSEA_API_KEY = process.env.OPENSEA_API_KEY
const OPENSEA_API_TESTNET_BASE_URL = 'https://testnets-api.opensea.io/wyvern/v1'
const OPENSEA_API_BASE_URL = 'https://api.opensea.io/wyvern/v1'
const LIMIT = 50

export interface OpenseaResponse {
  expiration_time: number
  created_date: string
  current_price: string
  asset: {
    permalink: string
  }
}

/**
 * Retrieve sell or buy orders
 * if buyOrSell is 0, it returns buy orders and else if it is 1, it returns sell orders
 * @param contract
 * @param tokenId
 * @param chainId
 * @param buyOrSell
 */
export const retrieveOrdersOpensea = async (
  contract: string,
  tokenId: string,
  chainId: string,
  buyOrSell: number,
): Promise<Array<OpenseaResponse>> => {
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
    let offset = 0
    // eslint-disable-next-line no-constant-condition
    while (true) {
      url = `${baseUrl}/orders?asset_contract_address=${contract}&bundled=false&include_bundled=false&token_id=${tokenId}&side=${buyOrSell}&limit=50&offset=${offset}&order_by=created_date&order_direction=desc`
      const res = await axios.get(url, config)
      if (res && res.data && res.data.orders) {
        const orders = res.data.orders as Array<OpenseaResponse>
        responses.push(...orders)
        if (orders.length < LIMIT) {
          break
        } else {
          offset = responses.length
          await delay(1000)
        }
      }
    }
    return responses
  } catch (err) {
    Sentry.captureException(err)
    Sentry.captureMessage(`Error in retrieveOrdersOpensea: ${err}`)
    return []
  }
}

export const retrieveOffersOpensea = async (
  contract: string,
  tokenId: string,
  chainId: string,
): Promise<Array<OpenseaResponse>> => {
  let url
  let config
  if (chainId === '4') {
    return await retrieveOrdersOpensea(contract, tokenId, chainId, 0)
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
      return []
    }
  }
}
