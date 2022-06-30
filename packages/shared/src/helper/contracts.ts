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
  case 5:
  case '5':
  case 'goerli':
    return utils.getAddress('0x7ffe04f3213d893bb4ebe76fbb49ca2a8f9c4610')
  case '1':
  case 1:
  case 'mainnet':
  default:
    return utils.getAddress('0x8C42428a747281B03F10C80e978C107D4d85E37F')
  }
}

// deployedGkTeamDistributor
export function genesisKeyTeamMerkleAddress(chainId: string | number = 'mainnet'): string {
  switch (chainId) {
  case '5':
  case 'goerli':
  case 5:
    return utils.getAddress('0x0000000000000000000000000000000000000000')
  case '1':
  case 1:
  case 'mainnet':
    return utils.getAddress('0x5fb1941b5415b4817d9CC62f8039F7A4B366Ff8F')
  }
}

export function genesisKeyTeamClaimAddress(chainId: string | number = 'mainnet'): string {
  switch (chainId) {
  case '5':
  case 'goerli':
  case 5:
    return utils.getAddress('0x4a76adbfF8aA29e0B6E051660119768e0f870557')
  case '1':
  case 1:
  case 'mainnet':
    return utils.getAddress('0xfc99E6b4447a17EA0C6162854fcb572ddC8FbB37')
  }
}

export function genesisKeyAddress(chainId: string | number = 'mainnet'): string {
  switch (chainId) {
  case '5':
  case 'goerli':
  case 5:
    return utils.getAddress('0xe0060010c2c81A817f4c52A9263d4Ce5c5B66D55')
  case '1':
  case 1:
  case 'mainnet':
    return utils.getAddress('0x8fB5a7894AB461a59ACdfab8918335768e411414')
  }
}

export function genesisKeyStakeAddress(chainId: string | number = 'mainnet'): string {
  switch (chainId) {
  case '5':
  case 'goerli':
  case 5:
    return utils.getAddress('0x0000000000000000000000000000000000000000')
  case '1':
  case 1:
  case 'mainnet':
    return utils.getAddress('0xFe687ed4Cd16BF383fcbd7409D33091bBAdDdf81')
  }
}

export function nftProfileAddress(chainId: string | number = 'mainnet'): string {
  switch (chainId) {
  case 5:
  case '5':
  case 'goerli':
    return utils.getAddress('0x073272c91A741E453aE47c10Be2F7ab5131B0706')
  case '1':
  case 1:
  case 'mainnet':
  default:
    return utils.getAddress('0x98ca78e89Dd1aBE48A53dEe5799F24cC1A462F2D')
  }
}

export function profileAuctionAddress(chainId: string | number = 'mainnet'): string {
  switch (chainId) {
  case '5':
  case 'goerli':
  case 5:
    return utils.getAddress('0x40023d97Ca437B966C8f669C91a9740C639E21C3')
  case '1':
  case 1:
  case 'mainnet':
    return utils.getAddress('0x30f649D418AF7358f9c8CB036219fC7f1B646309')
  }
}

export function validationLogicAddress(chainId: string | number = 'mainnet'): string {
  switch (chainId) {
  case 5:
  case '5':
  case 'goerli':
    return utils.getAddress('0x0000000000000000000000000000000000000000')
  case '1':
  case 1:
  case 'mainnet':
  default:
    return utils.getAddress('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2')
  }
}

export function marketplaceEventAddress(chainId: string | number = 'mainnet'): string {
  switch (chainId) {
  case 5:
  case '5':
  case 'goerli':
    return ''
  case '1':
  case 1:
  case 'mainnet':
  default:
    return utils.getAddress('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2')
  }
}

export function nftMarketplaceAddress(chainId: string | number = 'mainnet'): string {
  switch (chainId) {
  case 5:
  case '5':
  case 'goerli':
    return ''
  case '1':
  case 1:
  case 'mainnet':
  default:
    return utils.getAddress('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2')
  }
}

export function wethAddress(chainId: string | number = 'mainnet'): string {
  switch (chainId) {
  case 5:
  case '5':
  case 'goerli':
    return utils.getAddress('0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6')
  case '1':
  case 1:
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
  case 5:
  case '5':
  case 'goerli':
    return { contractAddress: utils.getAddress('0x9788C4E93f9002a7ad8e72633b11E8d1ecd51f9b') }
  case '1':
  case 1:
  case 'mainnet':
  default:
    return { contractAddress: utils.getAddress('0xb1f8e55c7f64d203c1400b9d8555d050f94adf39') }
  }
}

// blind whitelist winners
export function genesisKeyDistributor(chainId: string | number = 'mainnet'): string {
  switch (chainId) {
  case '5':
  case 'goerli':
  case 5:
    return ''
  case '1':
  case 1:
  case 'mainnet':
    return utils.getAddress('0x9F6ED3d90D48573245d6a0c0742db4eCf27B6a56')
  }
}

export const MintedProfileTopic = '0xfdbd996e3e72e8c7d34fc2f374c3c85c80a530bd1cdaa4a748d34e32103c5cc3'

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
  case 5:
  case '5':
  case 'goerli':
    return process.env.MNEMONIC_GOERLI
  case '1':
  case 1:
  case 'mainnet':
  default:
    return process.env.MNEMONIC
  }
}
