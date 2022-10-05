import { ethers } from 'ethers'

import { getNFTPortInterceptor } from '@nftcom/gql/adapter'
import { chainFromId } from '@nftcom/gql/helper/utils'
import { cache } from '@nftcom/gql/service/cache.service'
import { _logger } from '@nftcom/shared'
import * as Sentry from '@sentry/node'

const NFTPORT_API_BASE_URL = 'https://api.nftport.xyz/v0'

const logger = _logger.Factory(_logger.Context.NFTPort)

export interface NFTPortNFT {
  nft: {
    token_id?: string
    metadata_url?: string
    cached_file_url?: string
    metadata: {
      attributes: any
      name: string
      description: string
      image: string
      image_url: string
    }
  }
  contract: {
    name?: string
    symbol?: string
    type?: string
    metadata: {
      description?: string
      cached_thumbnail_url?: string
      cached_banner_url?: string
    }
  }
  status_message?: string
}

export const retrieveNFTDetailsNFTPort = async (
  contract: string,
  tokenId: string,
  chainId: string,
  refreshMetadata = false,
): Promise<NFTPortNFT | undefined> => {
  try {
    logger.debug(`starting retrieveNFTDetailsNFTPort: ${contract} ${tokenId} ${chainId}`)
    const key = `NFTPORT_NFT_DETAIL_${chainId}_${contract}_${tokenId}`
    const cachedData = await cache.get(key)
    if (cachedData)
      return JSON.parse(cachedData)
    const chain = chainFromId(chainId)
    if (!chain) return
    const nftInterceptor = getNFTPortInterceptor(NFTPORT_API_BASE_URL)
    const tokenIdInteger = ethers.BigNumber.from(tokenId).toString()
    const url = `/nfts/${contract}/${tokenIdInteger}${refreshMetadata ? '&refresh_metadata=true' : ''}`
    const res = await nftInterceptor.get(url, {
      params: {
        chain: chain,
      },
    })
    if (res && res?.data) {
      await cache.set(key, JSON.stringify(res.data), 'EX', 60 * 10)
      return res.data as NFTPortNFT
    } else return undefined
  } catch (err) {
    logger.error(`Error in retrieveNFTDetailsNFTPort: ${err}`)
    Sentry.captureMessage(`Error in retrieveNFTDetailsNFTPort: ${err}`)
    return undefined
  }
}
