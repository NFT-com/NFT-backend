import fetch from 'node-fetch'

import profileAuctionABIJSON from '@nftcom/shared/helper/abis/profile_auction.json'

export function nftTokenAddress(chainId: string | number = 'mainnet'): string {
  switch (chainId) {
  case 4:
  case '4':
  case 'rinkeby':
    return '0x4DE2fE09Bc8F2145fE12e278641d2c93B9D4393A'
  case '0':
  case 0:
  case 'mainnet':
  default:
    return '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
  }
}

export function profileAuctionAddress(chainId: string | number = 'mainnet'): string {
  switch (chainId) {
  case '4':
  case 'rinkeby':
  case 4:
    return '0x0684cb6f6dF529135E591b1F15028b57185d3195'
  case '0':
  case 0:
  case 'mainnet':
    return '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
  }
}

export const MintedProfileTopic = '0x848fe9120700715213a041f29982f684fa481b289b434ac7e2b36785af0a3826'

export function profileAuctionABI(): any {
  return profileAuctionABIJSON
}

export interface GasInfo {
  limit: number
  priceWei: number
}

export function getEthGasInfo(): Promise<GasInfo> {
  const endpoint = 'https://data-api.defipulse.com/api/v1/egs/api/ethgasAPI.json?api-key=' + process.env.ETH_GAS_STATION_API_KEY
  return fetch(endpoint)
    .then((response) => response.json())
    .then((response: any) => {
      const limit =  1500000
      const priceWei = response?.fast ? response?.fast / 10 : Number(10) * 1000000000

      return {
        limit,
        priceWei,
      }
    })
}