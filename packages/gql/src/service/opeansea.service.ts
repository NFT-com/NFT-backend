import axios from 'axios'
const OPENSEA_API_KEY = process.env.OPENSEA_API_KEY

interface Order {
  expiration_time: number
  created_date: string
  current_price: string
  permalink: string
}

export const retrieveOrderOpensea = async (
  contract: string,
  tokenId: string,
  chainId: string,
): Promise<any> => {
  let url
  let config
  if (chainId === '4') {
    url = `https://testnets-api.opensea.io/wyvern/v1/orders?asset_contract_address=${contract}&bundled=false&include_bundled=false&token_id=${tokenId}&side=1&limit=20&offset=0&order_by=created_date&order_direction=desc`
    config = {
      headers: { Accept: 'application/json' },
    }
  } else {
    url = `https://api.opensea.io/wyvern/v1/orders?asset_contract_address=${contract}&bundled=false&include_bundled=false&token_id=${tokenId}&side=1&limit=20&offset=0&order_by=created_date&order_direction=desc`
    config = {
      headers: {
        Accept: 'application/json',
        'X-API-KEY': OPENSEA_API_KEY,
      },
    }
  }
  try {
    const result = await axios.get(url, config)
    const order = result.data.orders[0] as Order
    return order
  } catch (e) {
    console.log(e)
  }
  return null
}
