import axios, { AxiosError, AxiosInstance } from 'axios'
import axiosRetry, { IAxiosRetryConfig } from 'axios-retry'
import { ethers } from 'ethers'

import { cache } from '@nftcom/gql/service/cache.service'
import { _logger } from '@nftcom/shared'
import * as Sentry from '@sentry/node'

const NFTPORT_API_KEY = process.env.NFTPORT_KEY
const NFTPORT_API_BASE_URL = 'https://api.nftport.xyz/v0'

const logger = _logger.Factory(_logger.Context.NFTPort)

export interface NFTPortNFT {
  metadata_url?: string
  cached_file_url?: string
  status_message?: string
}
const  getNFTPortInterceptor = (
  baseURL: string,
): AxiosInstance => {
  const instance = axios.create({
    baseURL,
    headers: {
      Authorization: NFTPORT_API_KEY,
      'Content-Type': 'application/json',
    },
  })

  // retry logic with exponential backoff
  const retryOptions: IAxiosRetryConfig= { retries: 3,
    retryCondition: (err: AxiosError<any>) => {
      return (
        axiosRetry.isNetworkOrIdempotentRequestError(err) ||
        err.response.status === 429
      )
    },
    retryDelay: (retryCount: number, err: AxiosError<any>) => {
      if (err.response) {
        const retry_after = err.response.headers['retry-after']
        if (retry_after) {
          return retry_after
        }
      }
      return axiosRetry.exponentialDelay(retryCount)
    },
  }
  axiosRetry(instance,  retryOptions)

  return instance
}

const chainFromId = (chainId: string): string | undefined => {
  switch(chainId) {
  case '1':
    return 'ethereum'
  case '4':
    return 'rinkeby'
  case '137':
    return 'polygon'
  default:
    return undefined
  }
}

export const retrieveNFTDetailsNFTPort = async (
  contract: string,
  tokenId: string,
  chainId: string,
): Promise<NFTPortNFT | undefined> => {
  try {
    const key = `NFTPORT_NFT_DETAIL_${chainId}_${contract}_${tokenId}`
    const cachedData = await cache.get(key)
    if (cachedData)
      return JSON.parse(cachedData)
    const chain = chainFromId(chainId)
    if (!chain) return
    const nftInterceptor = getNFTPortInterceptor(NFTPORT_API_BASE_URL)
    const tokenIdInteger = ethers.BigNumber.from(tokenId).toString()
    const url = `/nfts/${contract}/${tokenIdInteger}`
    const res = await nftInterceptor.get(url, {
      params: {
        chain: chain,
      },
    })
    if (res && res.data && res.data.nft) {
      await cache.set(key, JSON.stringify(res.data.nft), 'EX', 60 * 10)
      return res.data.nft as NFTPortNFT
    } else return undefined
  } catch (err) {
    logger.error(`Error in retrieveNFTDetailsNFTPort: ${err}`)
    Sentry.captureMessage(`Error in retrieveNFTDetailsNFTPort: ${err}`)
    return undefined
  }
}
