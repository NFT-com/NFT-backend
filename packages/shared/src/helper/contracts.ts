import { utils } from 'ethers'
import fetch from 'node-fetch'

import profileAuctionABIJSON from '@nftcom/shared/helper/abis/profile_auction.json'

// TODO: move contract addresses to Doppler.

export function nftMarketplaceAddress(chainId: string | number = 'mainnet'): string {
  switch (chainId) {
  case 4:
  case '4':
  case 'rinkeby':
    return utils.getAddress('0xA3509a064A54a7a60Fc4Db0245ef44F812f439f6')
  case '0':
  case 0:
  case 'mainnet':
  default:
    return utils.getAddress('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2')
  }
}

export function wethAddress(chainId: string | number = 'mainnet'): string {
  switch (chainId) {
  case 4:
  case '4':
  case 'rinkeby':
    return utils.getAddress('0xc778417E063141139Fce010982780140Aa0cD5Ab')
  case '0':
  case 0:
  case 'mainnet':
  default:
    return utils.getAddress('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2')
  }
}
interface Options {
  // Choose a custom contract address. Must be provided to run the
  // code on non-mainnet network.
  contractAddress?: string
}

// https://github.com/wbobeirne/eth-balance-checker (multi balance contract)
export function multiBalance(chainId: string | number = 'mainnet'): Options {
  switch (chainId) {
  case 4:
  case '4':
  case 'rinkeby':
    return { contractAddress: utils.getAddress('0x3183B673f4816C94BeF53958BaF93C671B7F8Cf2') }
  case '0':
  case 0:
  case 'mainnet':
  default:
    return { contractAddress: utils.getAddress('0xb1f8e55c7f64d203c1400b9d8555d050f94adf39') }
  }
}

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

export function nftProfileAddress(chainId: string | number = 'mainnet'): string {
  switch (chainId) {
  case 4:
  case '4':
  case 'rinkeby':
    return utils.getAddress('0xc5782D87B3d353edbf1B03dEB001949Afd2e25E8')
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
    return utils.getAddress('0x2295828BBB9270cF92D29ed79bA0260d64fdF23f')
  case '0':
  case 0:
  case 'mainnet':
    return utils.getAddress('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')
  }
}

export function genesisKeyAddress(chainId: string | number = 'mainnet'): string {
  switch (chainId) {
  case '4':
  case 'rinkeby':
  case 4:
    return utils.getAddress('0x9F6ED3d90D48573245d6a0c0742db4eCf27B6a56')
  case '0':
  case 0:
  case 'mainnet':
    return utils.getAddress('0x9F6ED3d90D48573245d6a0c0742db4eCf27B6a56')
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
  const gasLimit =  1500000
  const defaultPriceGwei = 200
  const endpoint = 'https://data-api.defipulse.com/api/v1/egs/api/ethgasAPI.json?api-key=' + process.env.ETH_GAS_STATION_API_KEY

  return fetch(endpoint, {
    headers: {
      'Accept': 'application/json',
    },
  })
    .then((response) => response.json())
    .then((response: any) => {
      const priceGwei = response?.fastest ? response?.fastest / 10 : defaultPriceGwei
  
      // only use gas station for mainnet, otherwise apply gas manually
      if (chainId === 1) {
        return {
          gasLimit,
          gasPrice: priceGwei,
        }
      }
      else {
        return {
          gasLimit: 1500000,
          gasPrice: 3000000000,
        }
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
