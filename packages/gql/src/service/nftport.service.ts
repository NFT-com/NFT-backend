import { BigNumber, ethers } from 'ethers'
import qs from 'qs'

import { cache } from '@nftcom/cache'
import { chainFromId } from '@nftcom/gql/helper/utils'
import { fetchData, getNFTPortInterceptor } from '@nftcom/nftport-client'
import { _logger } from '@nftcom/shared'
import * as Sentry from '@sentry/node'

const NFTPORT_API_BASE_URL = 'https://api.nftport.xyz/v0'

const logger = _logger.Factory(_logger.Context.NFTPort)

export interface NFTPortRarityAttributes {
  trait_type: string
  value: string
  statistics: {
    total_count: number
    prevalence: number
  }
}

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
    rarity?: {
      strategy: string
      score: number
      rank: number
      max_rank: number
      updated_date: string
    }
    attributes?: NFTPortRarityAttributes[]
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
    const url = `/nfts/${contract}/${tokenIdInteger}`
    const res = await nftInterceptor.get(url, {
      params: {
        chain: chain,
        refresh_metadata: refreshMetadata || undefined,
        include: ['attributes'],
      },
      paramsSerializer: (params) => qs.stringify(params, { arrayFormat: 'repeat' }),
    })
    if (res && res?.data) {
      await cache.set(key, JSON.stringify(res.data), 'EX', 60 * 10)
      return res.data as NFTPortNFT
    } else {
      return undefined
    }
  } catch (err) {
    logger.error(JSON.stringify(err))
    logger.error(`Error in retrieveNFTDetailsNFTPort: ${err}`)
    Sentry.captureMessage(`Error in retrieveNFTDetailsNFTPort: ${err}`)
    return undefined
  }
}

export const retrieveContractNFTs = async (
  contract: string,
  chainId: string,
  refreshMetadata = false,
): Promise<any> => {
  try {
    logger.debug(`starting retrieveContractNFTs: ${contract} ${chainId}`)
    const key = `NFTPORT_CONTRACT_NFTS_${chainId}_${contract}`
    const cachedData = await cache.get(key)
    if (cachedData)
      return JSON.parse(cachedData)
    const chain = chainFromId(chainId)
    if (!chain) return
    const nftInterceptor = getNFTPortInterceptor(NFTPORT_API_BASE_URL)
    const url = `/nfts/${contract}`
    const res = await nftInterceptor.get(url, {
      params: {
        chain: chain,
        refresh_metadata: refreshMetadata || undefined,
      },
    })
    if (res && res?.data) {
      await cache.set(key, JSON.stringify(res.data), 'EX', 60 * 10)
      return res.data
    } else {
      return undefined
    }
  } catch (err) {
    logger.error(`Error in retrieveContractNFTs: ${err}`)
    Sentry.captureMessage(`Error in retrieveContractNFTs: ${err}`)
    return undefined
  }
}

export const fetchTxsFromNFTPort = async (
  endpoint: string,
  chain: string,
  type: string[],
  contractAddress: string,
  tokenId?: string,
): Promise<any[]> => {
  try {
    const availableTypes = ['transfer', 'burn', 'mint', 'sale', 'list', 'all']
    const filteredType = type.filter((t) => availableTypes.indexOf(t) !== -1)
    const nftPortResult = []
    let args, cacheKey
    if (tokenId) {
      cacheKey = `NFTPORT_${endpoint}_${chain}_${JSON.stringify(filteredType)}_${contractAddress}_${BigNumber.from(tokenId).toHexString()}`
      args = [contractAddress, BigNumber.from(tokenId).toString()]
    } else {
      cacheKey = `NFTPORT_${endpoint}_${chain}_${JSON.stringify(filteredType)}_${contractAddress}`
      args = [contractAddress]
    }
    const cachedData = await cache.get(cacheKey)
    if (cachedData) {
      return JSON.parse(cachedData)
    }
    // fetch txs from NFTPort client we built
    let res = await fetchData(endpoint, args, {
      queryParams: {
        chain,
        type: type,
        page_size: 50,
        cacheSeconds: 60 * 10,
      },
    })
    if (res?.transactions) {
      nftPortResult.push(...res.transactions)
      if (res?.continuation) {
        let continuation = res?.continuation
        // eslint-disable-next-line no-constant-condition
        while (true) {
          res = await fetchData(endpoint, args, {
            queryParams: {
              chain,
              type: type,
              continuation,
              page_size: 50,
              cacheSeconds: 60 * 10,
            },
          })
          if (res?.transactions) {
            nftPortResult.push(...res.transactions)
            if (res?.continuation) {
              continuation = res?.continuation
            } else {
              break
            }
          } else {
            break
          }
        }
      }
      await cache.set(cacheKey, JSON.stringify(nftPortResult), 'EX', 60 * 10) // 10 min
      return nftPortResult
    } else {
      return []
    }
  } catch (err) {
    logger.error(`Error in fetchTxsFromNFTPort: ${err}`)
    Sentry.captureMessage(`Error in fetchTxsFromNFTPort: ${err}`)
    return []
  }
}
