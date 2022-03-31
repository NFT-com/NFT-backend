import { utils } from 'ethers'
import fetch from 'node-fetch'

import genesisKeyABIJSON from '@nftcom/shared/helper/abis/GenesisKey.json'
import genKeyClaimABIJSON from '@nftcom/shared/helper/abis/GenesisKeyDistributor.json'
import genKeyStakeABIJSON from '@nftcom/shared/helper/abis/GenesisNftStake.json'
import marketplaceEventABIJSON from '@nftcom/shared/helper/abis/MarketplaceEvent.json'
import merkleAirdropABIJSON from '@nftcom/shared/helper/abis/MerkleDistributor.json'
import nftMarketplaceABIJSON from '@nftcom/shared/helper/abis/NftMarketplace.json'
import nftProfileABIJSON from '@nftcom/shared/helper/abis/NftProfile.json'
import profileAuctionABIJSON from '@nftcom/shared/helper/abis/ProfileAuction.json'
import validationLogicABIJSON from '@nftcom/shared/helper/abis/ValidationLogic.json'

// TODO: move contract addresses to Doppler
export function nftMarketplaceAddress(chainId: string | number = 'mainnet'): string {
  switch (chainId) {
  case 4:
  case '4':
  case 'rinkeby':
    return utils.getAddress('0xbb5fc6e4BdD97B11a1CB41C5EE7DE842744BCC9b')
  case '0':
  case 0:
  case 'mainnet':
  default:
    return utils.getAddress('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2')
  }
}

export function marketplaceEventAddress(chainId: string | number = 'mainnet'): string {
  switch (chainId) {
  case 4:
  case '4':
  case 'rinkeby':
    return utils.getAddress('0x5fF8777B6B8DcA1616891BBCcdecF2aCcc6cF7b8')
  case '0':
  case 0:
  case 'mainnet':
  default:
    return utils.getAddress('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2')
  }
}

export function validationLogicAddress(chainId: string | number = 'mainnet'): string {
  switch (chainId) {
  case 4:
  case '4':
  case 'rinkeby':
    return utils.getAddress('0x8793B5B9B8e54D1C5aeD40b679d021ef47c2D20B')
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
    return utils.getAddress('0xB0424DFEBA067023D83979864A8cA4640F6B77Fd')
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
    return utils.getAddress('0x26E13D1c3D5B081CdFADB025324624753bC06c78')
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
    return utils.getAddress('0x386B1a1C8Bc6d3Ca3cF66f15f49742a9a2840CA2')
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
    return utils.getAddress('0x52Ec5398c29d6627E543931C473Ba36c2bBE0f5C')
  case '0':
  case 0:
  case 'mainnet':
    return utils.getAddress('0x9F6ED3d90D48573245d6a0c0742db4eCf27B6a56')
  }
}

export function genesisKeyStakeAddress(chainId: string | number = 'mainnet'): string {
  switch (chainId) {
  case '4':
  case 'rinkeby':
  case 4:
    return utils.getAddress('0xfF3a11c64AC3e0cF912001327AF4F6EE867C57dC')
  case '0':
  case 0:
  case 'mainnet':
    return utils.getAddress('0x9F6ED3d90D48573245d6a0c0742db4eCf27B6a56')
  }
}

export function genesisKeyTeamMerkleAddress(chainId: string | number = 'mainnet'): string {
  switch (chainId) {
  case '4':
  case 'rinkeby':
  case 4:
    return utils.getAddress('0xf4CB1960416a7a676eE1AB9C6808B73254EEE32F')
  case '0':
  case 0:
  case 'mainnet':
    return utils.getAddress('0x9F6ED3d90D48573245d6a0c0742db4eCf27B6a56')
  }
}

export function genesisKeyTeamClaimAddress(chainId: string | number = 'mainnet'): string {
  switch (chainId) {
  case '4':
  case 'rinkeby':
  case 4:
    return utils.getAddress('0xb2e8e382df819AA3EBb29906f613A8609F918e2e')
  case '0':
  case 0:
  case 'mainnet':
    return utils.getAddress('0x9F6ED3d90D48573245d6a0c0742db4eCf27B6a56')
  }
}

export function genesisKeyDistributor(chainId: string | number = 'mainnet'): string {
  switch (chainId) {
  case '4':
  case 'rinkeby':
  case 4:
    return utils.getAddress('0x34204485ac5DaD29DCD29DE7b2E360a45f975046')
  case '0':
  case 0:
  case 'mainnet':
    return utils.getAddress('0x9F6ED3d90D48573245d6a0c0742db4eCf27B6a56')
  }
}

export const MintedProfileTopic = '0x848fe9120700715213a041f29982f684fa481b289b434ac7e2b36785af0a3826'

export function validationLogicABI(): any {
  return validationLogicABIJSON
}

export function profileAuctionABI(): any {
  return profileAuctionABIJSON
}

export function marketplaceABIJSON(): any {
  return nftMarketplaceABIJSON
}

export function marketplaceEventABI(): any {
  return marketplaceEventABIJSON
}

export function NftProfileABI(): any {
  return nftProfileABIJSON
}

export function GenesisKeyABI(): any {
  return genesisKeyABIJSON
}

export function GenKeyStakeABI(): any {
  return genKeyStakeABIJSON
}

export function merkleAirdropABI(): any {
  return merkleAirdropABIJSON
}

export function genKeyClaimABI(): any {
  return genKeyClaimABIJSON
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
