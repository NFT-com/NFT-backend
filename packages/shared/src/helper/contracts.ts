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
export function nftTokenAddress(chainId: string | number = 'mainnet'): string {
  switch (chainId) {
  case 4:
  case '4':
  case 'rinkeby':
    return utils.getAddress('0x4aA4Cd36e21dCc2247b5FB5e30ED4D5808f7ECc1')
  case '0':
  case 0:
  case 'mainnet':
  default:
    return utils.getAddress('0x8C42428a747281B03F10C80e978C107D4d85E37F')
  }
}

// deployedGkTeamDistributor
export function genesisKeyTeamMerkleAddress(chainId: string | number = 'mainnet'): string {
  switch (chainId) {
  case '4':
  case 'rinkeby':
  case 4:
    return utils.getAddress('0xaE8F59CC5294Ad07a135eB39D361512aA9DaCb89')
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
    return utils.getAddress('0x46b7f6864cD071845de69ce7E9D82EDBBDc7054F')
  case '0':
  case 0:
  case 'mainnet':
    return utils.getAddress('0x9F6ED3d90D48573245d6a0c0742db4eCf27B6a56')
  }
}

export function genesisKeyAddress(chainId: string | number = 'mainnet'): string {
  switch (chainId) {
  case '4':
  case 'rinkeby':
  case 4:
    return utils.getAddress('0x8cE66A6Bb03Fb407D9E9D8327e266e54058d7362')
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
    return utils.getAddress('0x7C056980e27AE75D01052C21cb598f368e01DE59')
  case '0':
  case 0:
  case 'mainnet':
    return utils.getAddress('0x9F6ED3d90D48573245d6a0c0742db4eCf27B6a56')
  }
}

export function nftProfileAddress(chainId: string | number = 'mainnet'): string {
  switch (chainId) {
  case 4:
  case '4':
  case 'rinkeby':
    return utils.getAddress('0xd7Fd5046a2523841Ee840d7574B54591300bAcB6')
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
    return utils.getAddress('0xbc6BA73F5822abff07F6BABa7617E78a6C0729c6')
  case '0':
  case 0:
  case 'mainnet':
    return utils.getAddress('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')
  }
}

export function validationLogicAddress(chainId: string | number = 'mainnet'): string {
  switch (chainId) {
  case 4:
  case '4':
  case 'rinkeby':
    return utils.getAddress('0x10CF5F4C7cEeBb483A64E9500816f7356dC9379a')
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
    return utils.getAddress('0x0Fae273409Ad108692d6515dd134A338364f1689')
  case '0':
  case 0:
  case 'mainnet':
  default:
    return utils.getAddress('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2')
  }
}

export function nftMarketplaceAddress(chainId: string | number = 'mainnet'): string {
  switch (chainId) {
  case 4:
  case '4':
  case 'rinkeby':
    return utils.getAddress('0x4dCF39912385A00ed722ce0b70A21d616eA6BAEC')
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

// blind whitelist winners
export function genesisKeyDistributor(chainId: string | number = 'mainnet'): string {
  switch (chainId) {
  case '4':
  case 'rinkeby':
  case 4:
    return utils.getAddress('')
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
