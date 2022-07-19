import axios from 'axios'

import * as Sentry from '@sentry/node'

const LOOKSRARE_API_BASE_URL = 'https://api.looksrare.org/api/v1'
const LOOKSRARE_API_TESTNET_BASE_URL = 'https://api-rinkeby.looksrare.org/api/v1'

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
    Sentry.captureMessage(`Error in retrieveOrdersLooksrare: ${err}`)
    return undefined
  }
}
