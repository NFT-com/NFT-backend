import { utils } from 'ethers'
import fetch from 'node-fetch'

import profileAuctionABIJSON from '@nftcom/shared/helper/abis/profile_auction.json'

export function nftTokenAddress(chainId: string | number = 'mainnet'): string {
  switch (chainId) {
  case 4:
  case '4':
  case 'rinkeby':
    return utils.getAddress('0xa75F995f252ba5F7C17f834b314201271d32eC35')
  case '0':
  case 0:
  case 'mainnet':
  default:
    return utils.getAddress('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')
  }
}

export function profileAuctionAddress(chainId: string | number = 'mainnet'): string {
  switch (chainId) {
  case '4':
  case 'rinkeby':
  case 4:
    return utils.getAddress('0x0684cb6f6dF529135E591b1F15028b57185d3195')
  case '0':
  case 0:
  case 'mainnet':
    return utils.getAddress('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')
  }
}

export const MintedProfileTopic = '0x848fe9120700715213a041f29982f684fa481b289b434ac7e2b36785af0a3826'

export function profileAuctionABI(): any {
  return profileAuctionABIJSON
}

export interface GasInfo {
  gasLimit: number
  gasPrice: number
}

export function getEthGasInfo(chainId: number): Promise<GasInfo> {
  if (chainId !== 1) {
    return null
  }
  const endpoint = 'https://data-api.defipulse.com/api/v1/egs/api/ethgasAPI.json?api-key=' + process.env.ETH_GAS_STATION_API_KEY
  const gasLimit =  1500000
  const defaultPriceGwei = 200
  return fetch(endpoint, {
    headers: {
      'Accept': 'application/json',
    },
  })
    .then((response) => response.json())
    .then((response: any) => {
      const priceGwei = response?.fastest ? response?.fastest / 10 : defaultPriceGwei
  
      return {
        gasLimit,
        gasPrice: priceGwei,
      }
    })
    .catch(() => {
      return {
        gasLimit,
        gasPrice: defaultPriceGwei,
      }
    })
}

export function getProfileAuctionMnemonic(chainId: string | number): string {
  switch (chainId) {
  case 4:
  case '4':
  case 'rinkeby':
    return process.env.MNEMONIC_RINKEBY
  case '0':
  case 0:
  case 'mainnet':
  default:
    return process.env.MNEMONIC
  }
}