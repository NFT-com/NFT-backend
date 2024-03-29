import axios, { AxiosError, AxiosInstance, AxiosResponse } from 'axios'
import axiosRetry, { IAxiosRetryConfig } from 'axios-retry'
import { BigNumber, utils as ethersUtils } from 'ethers'
import { chunk } from 'lodash'
import { performance } from 'perf_hooks'
import * as typeorm from 'typeorm'
import { ILike, In } from 'typeorm'

import { Upload } from '@aws-sdk/lib-storage'
import { cache, CacheKeys, removeExpiredTimestampedZsetMembers } from '@nftcom/cache'
import { appError, collectionError, nftError } from '@nftcom/error-types'
import { assetBucket } from '@nftcom/gql/config'
import { gql, Pageable } from '@nftcom/gql/defs'
import { Context } from '@nftcom/gql/defs'
import { GetCollectionInfoArgs } from '@nftcom/gql/defs'
import { auth, pagination } from '@nftcom/gql/helper'
import { getCollectionDeployer } from '@nftcom/gql/service/alchemy.service'
import { delay } from '@nftcom/gql/service/core.service'
import {
  contentTypeFromExt,
  extensionFromFilename,
  fetchDataUsingMulticall,
  fetchWithTimeout,
  generateWeight,
  getAWSConfig,
  getLastWeight,
  midWeight,
  nftAbi,
  optionallySaveUserAndWalletForAssociatedAddress,
  paginatedOffsetResultsFromEntitiesBy,
  processIPFSURL,
  s3ToCdn,
  tokenUriAbi,
} from '@nftcom/gql/service/core.service'
import { NFTPortRarityAttributes } from '@nftcom/gql/service/nftport.service'
import { NFTPortNFT, retrieveNFTDetailsNFTPort } from '@nftcom/gql/service/nftport.service'
import { getOpenseaInterceptor } from '@nftcom/gql/service/opensea.service'
import { SearchEngineService } from '@nftcom/gql/service/searchEngine.service'
import { paginatedActivitiesBy } from '@nftcom/gql/service/txActivity.service'
import { _logger, contracts, db, defs, entity, fp, helper, provider, typechain } from '@nftcom/shared'
import * as Sentry from '@sentry/node'

import { clearNftCache, nft as nftLoader } from '../dataloader'

const repositories = db.newRepositories()
const logger = _logger.Factory(_logger.Context.Misc, _logger.Context.GraphQL)
const seService = SearchEngineService()

// Free Account from Infura
const infuraCredentials = [
  { apiKey: '2ObT6if8jf8lnsmDOyo3H1FXOuh', secret: 'ca25329ebbd733eacebccfd2fac47674' },
  { apiKey: '2ObTRj74ulJqLhBGuDKZGLoGGQu', secret: '28f76c2f44bbcde2596ad0bc0de8de24' },
  { apiKey: '2ObU0PWa9oJ0hAJNVo5ijChH45x', secret: '2c5348b233829c45fe6406d0cfa0d8ae' },
  // { apiKey: '2NvtbGeEmgbJMojDAobTdIUXsTH', secret: '99d5962cdb1b722fc57feb8c0266989c' } // until key limits come back to normal
]
const CRYPTOPUNK = '0xb47e3cd837ddf8e4c57f05d70ab865de6e193bbb'
const MAX_SAVE_COUNTS = 500
const MAX_RETRIES = 3
const INITIAL_DELAY_MS = 1000
const BATCH_LOG_SIZE = 100
let logInfoBatch = []
const exceptionBannerUrlRegex = /https:\/\/cdn.nft.com\/collections\/1\/.*banner\.*/
const TEST_WALLET_ID = 'test'

let alchemyUrl: string
let chainId = process.env.CHAIN_ID

interface TokenRequest {
  schema: 'erc721' | 'erc1155'
  contractAddress: string
  tokenId: string
}

interface AlchemyContractMetaData {
  name?: string
  symbol?: string
  totalSupply?: string
  tokenType?: string
  contractDeployer?: string
  deployedBlockNumber?: number
  openSea?: {
    floorPrice?: number
    collectionName?: string
    safelistRequestStatus?: string
    imageUrl?: string
    description?: string
    externalUrl?: string
    twitterUsername?: string
    discordUrl?: string
    lastIngestedAt?: string
  }
}

interface AlchemyContractMetaDataResponse {
  address: string
  contractMetadata: AlchemyContractMetaData
}

interface MediaObjects {
  raw?: string
  gateway?: string
  thumbnail?: string
  format?: string
  bytes?: number
}

export interface AlchemyNFTMetaDataResponse {
  contract?: {
    address?: string
  }
  id?: {
    tokenId?: string
    tokenMetadata?: {
      tokenType?: string
    }
  }
  title?: string
  description?: string
  tokenUri?: {
    gateway: string
    raw: string
  }
  media?: {
    uri?: {
      gateway?: string
      thumbnail?: string
      raw?: string
      format?: string
      bytes?: number
    }
  }
  metadata?: {
    name?: string
    image?: string
    external_url?: string
    background_color?: string
    attributes?: Array<Record<string, any>>
    media?: Array<MediaObjects>
  }
  timeLastUpdated?: string
  contractMetadata?: AlchemyContractMetaData
}

type Metadata = {
  name: string
  image: string
  traits: Array<{ type: string; value: string }>
  description: string | null
}

type ApiResponse = {
  name: string
  description?: string
  image?: string
  image_url?: string
  imageUrl?: string
  image_data?: string
  created_by?: string
  external_url?: string
  attributes: Array<{ trait_type: string; value: string; display_type?: string }>
  animation_details?: any
  animation?: string
  animation_url?: string
  image_details?: any
  dna?: string
  edition?: number
  date?: number
  compiler?: string
  imageHash?: string
  header?: string
  reward_bitmask?: number
}

type NFTOrder = {
  nftId: string
  newIndex: number
}

type NFTMetaData = {
  type: defs.NFTType
  name: string
  description: string
  image: string
  traits: defs.Trait[]
}

export const getAlchemyApiUrl = (chainId: string): string => {
  const apiKey = chainId === '1' ? process.env.ALCHEMY_API_KEY : process.env.ALCHEMY_TESTNET_KEY
  return `https://eth-mainnet.alchemyapi.io/v2/${apiKey}`
}

export const initiateWeb3 = (cid?: string): void => {
  chainId = cid || process.env.CHAIN_ID // attach default value
  alchemyUrl = getAlchemyApiUrl(chainId)
}

export const getAlchemyInterceptor = (chainId: string, customApiKey?: string): AxiosInstance => {
  const alchemyInstance = axios.create({
    baseURL: customApiKey ?? getAlchemyApiUrl(chainId || process.env.CHAIN_ID),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  })
  // retry logic with exponential backoff
  const retryOptions: IAxiosRetryConfig = {
    retries: 3,
    retryCondition: (err: AxiosError<any>) => {
      if (err.response.status === 429) {
        logger.error(err, '[alchemy-interceptor] Alchemy Rate Limit')
      }
      return axiosRetry.isNetworkOrIdempotentRequestError(err) || err.response.status === 429
    },
    retryDelay: (retryCount: number, err: AxiosError<any>) => {
      if (err.response) {
        const retry_after = Number(err.response.headers['retry-after'])
        if (retry_after) {
          return retry_after
        }
      }
      return axiosRetry.exponentialDelay(retryCount)
    },
  }
  axiosRetry(alchemyInstance, retryOptions)
  return alchemyInstance
}

export const refreshContractAlchemy = async (
  contractAddress: string,
  customApiKey = 'ICRpDfTma_4hsGe0rjSfH0tazKtL_koe',
): Promise<void> => {
  try {
    initiateWeb3(process.env.CHAIN_ID)
    const alchemyInstance: AxiosInstance = await getAlchemyInterceptor(process.env.CHAIN_ID, customApiKey)
    const response: AxiosResponse = await alchemyInstance.get(`/refreshContract?contractAddress=${contractAddress}`)
    if (response?.data?.success) {
      logger.info(`[refreshContractAlchemy] ${contractAddress} refreshed successfully`)
    }
  } catch (e) {
    logger.error(e, `[refreshContractAlchemy] ${contractAddress} refresh failed`)
  }
}

export const getNFTsFromAlchemyPage = async (
  owner: string,
  {
    contracts,
    withMetadata = true,
    excludeSpam = true,
    excludeAirdrops = false,
    pageKey,
  }: {
    contracts?: string[]
    withMetadata?: boolean
    excludeSpam?: boolean
    excludeAirdrops?: boolean
    pageKey?: string
  } = {},
): Promise<[AlchemyNFTMetaDataResponse[], string | undefined]> => {
  try {
    initiateWeb3(process.env.CHAIN_ID)
    const alchemyInstance: AxiosInstance = await getAlchemyInterceptor(process.env.CHAIN_ID)
    let queryParams = `owner=${owner}`

    if (contracts) {
      queryParams += `&contractAddresses[]=${contracts}`
    }

    if (withMetadata) {
      queryParams += `&withMetadata=${withMetadata}`
    }

    if (excludeSpam && chainId === '1') {
      queryParams += '&excludeFilters[]=SPAM'
    }

    if (excludeAirdrops && chainId === '1') {
      queryParams += '&excludeFilters[]=AIRDROPS'
    }

    if (pageKey) {
      queryParams += `&pageKey=${pageKey}`
    }

    const response: AxiosResponse = await alchemyInstance.get(`/getNFTs?${queryParams}`)

    if (response?.data?.ownedNfts) {
      return [response.data.ownedNfts as AlchemyNFTMetaDataResponse[], response.data.pageKey]
    } else {
      return [[], undefined]
    }
  } catch (err) {
    logger.error(err, 'Error in getNFTsFromAlchemyPage')
    Sentry.captureMessage(`Error in getNFTsFromAlchemyPage: ${err}`)
    throw err
  }
}

export const getNFTsFromAlchemy = async (
  owner: string,
  contracts?: string[],
  withMetadata = true,
): Promise<AlchemyNFTMetaDataResponse[]> => {
  try {
    let pageKey
    const ownedNFTs: Array<AlchemyNFTMetaDataResponse> = []
    const alchemyInstance: AxiosInstance = await getAlchemyInterceptor(process.env.CHAIN_ID)
    let queryParams = `owner=${owner}`

    if (contracts) {
      queryParams += `&contractAddresses[]=${contracts}`
    }

    if (withMetadata) {
      queryParams += `&withMetadata=${withMetadata}`
    }

    const response: AxiosResponse = await alchemyInstance.get(`/getNFTs?${queryParams}`)

    if (response?.data?.ownedNfts) {
      ownedNFTs.push(...(response?.data?.ownedNfts as AlchemyNFTMetaDataResponse[]))
      if (response?.data?.pageKey) {
        pageKey = response?.data?.pageKey
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const res: AxiosResponse = await alchemyInstance.get(`/getNFTs?${queryParams}&pageKey=${pageKey}`)

          if (res?.data?.ownedNfts) {
            ownedNFTs.push(...(res?.data?.ownedNfts as AlchemyNFTMetaDataResponse[]))
            if (res?.data?.pageKey) {
              pageKey = res?.data?.pageKey
            } else {
              break
            }
          } else {
            break
          }
        }
      }

      return ownedNFTs
    } else {
      return []
    }
  } catch (err) {
    logger.error(`Error in getNFTsFromAlchemy: ${err}`)
    Sentry.captureMessage(`Error in getNFTsFromAlchemy: ${err}`)
    throw err
  }
}

export const getOwnersForNFT = async (nft: typeorm.DeepPartial<entity.NFT>): Promise<string[]> => {
  try {
    initiateWeb3(nft.chainId)
    const contract = helper.checkSum(nft.contract)

    const baseUrl = `${alchemyUrl}/getOwnersForToken?contractAddress=${contract}&tokenId=${nft.tokenId}`
    const response = await axios.get(baseUrl)

    if (response && response?.data && response.data?.owners) {
      return response.data.owners as string[]
    } else {
      return Promise.reject(`No owners for NFT contract ${contract} tokenId ${nft.tokenId} on chain ${nft.chainId}`)
    }
  } catch (err) {
    logger.error(`Error in getOwnersForNFT: ${err}`)
    Sentry.captureMessage(`Error in getOwnersForNFT: ${err}`)
    throw err
  }
}

export const getOwnersForNFT2 = async (chainId: string, nftContract: string, tokenId: string): Promise<string[]> => {
  try {
    initiateWeb3(chainId)
    const contract = helper.checkSum(nftContract)

    const baseUrl = `${alchemyUrl}/getOwnersForToken?contractAddress=${contract}&tokenId=${tokenId}`
    const response = await axios.get(baseUrl)

    if (response && response?.data && response.data?.owners) {
      return response.data.owners as string[]
    } else {
      return Promise.reject(`No owners for NFT contract ${contract} tokenId ${tokenId} on chain ${chainId}`)
    }
  } catch (err) {
    logger.error(`Error in getOwnersForNFT: ${err}`)
    Sentry.captureMessage(`Error in getOwnersForNFT: ${err}`)
    throw err
  }
}

/**
 * Takes a bunch of NFTs (pulled from the DB), and checks
 * that the given owner is still correct.
 *
 * If not, deletes the NFT record from the DB.
 */
export const filterNFTsWithMulticall = async (
  nfts: Array<typeorm.DeepPartial<entity.NFT>>,
  owner: string,
): Promise<void> => {
  try {
    let start = new Date().getTime()
    const nftsToUpdate = []
    const newOwners = {}
    const missingOwners = {}

    /* -------------------- generate arguments for multicall -------------------- */
    const multicallArgs = nfts.map(({ tokenId, contract }) => {
      return {
        contract,
        name: 'ownerOf',
        params: [BigNumber.from(tokenId)],
      }
    })

    logger.info(
      `filterNFTsWithMulticall 0: starting batch for userId=${nfts[0]?.userId || '-'} ${owner} with ${
        multicallArgs.length
      } nfts ${new Date().getTime() - start}ms, calls: ${JSON.stringify(multicallArgs)}`,
    )
    start = new Date().getTime()

    /* -- use multicall to decrease number to be more efficient with web3 calls - */
    /* ------------ also increases speed of updates bc 1000 at a time ----------- */
    /* ------ more info on multicall: https://github.com/makerdao/multicall ----- */
    const ownersOf = await fetchDataUsingMulticall(
      multicallArgs,
      nftAbi,
      '1',
      false,
      provider.provider(Number(chainId)),
    )

    logger.info(
      `filterNFTsWithMulticall 0b: found ownersOf userId=${nfts[0]?.userId || '-'} ${owner} with ${
        multicallArgs.length
      } nfts ${new Date().getTime() - start}ms, ownersOf=${JSON.stringify(ownersOf)}`,
    )

    for (const [i, data] of ownersOf.entries()) {
      if (!data) missingOwners[i] = data
      else {
        const newOwner = helper.checkSum(data[0])
        if (newOwner != helper.checkSum(owner)) {
          logger.info(
            `filterNFTsWithMulticall: new owner userId=${nfts[0]?.userId || '-'} ${owner} for ${
              nfts[i].id
            } is now ${newOwner}`,
          )
          newOwners[`${nfts[i].id}-${nfts[i].contract}-${nfts[i].tokenId}-${nfts[i].type}-${nfts[i].chainId}`] =
            newOwner
          nftsToUpdate.push(nfts[i])
        }
      }
    }

    const newNftOwnerKeys = Object.keys(newOwners)

    if (newNftOwnerKeys.length) {
      logger.info(
        `filterNFTsWithMulticall 1: userId=${nfts[0]?.userId || '-'} ${owner}, new owners = ${newNftOwnerKeys.length}/${
          nfts.length
        } nfts, ${new Date().getTime() - start}ms`,
      )
      start = new Date().getTime()
    }

    /* ------------------- Loop through new NFT owner updates ------------------- */
    newNftOwnerKeys.forEach(async key => {
      const [nftId, nftContact, nftTokenId, nftType, nftChainId] = key.split('-')

      if (nftId) {
        logger.info(
          `filterNFTsWithMulticall 2: userId=${nfts[0]?.userId || '-'} ${owner}, updating nft ${nftId}, key=${key} ${
            new Date().getTime() - start
          }ms`,
        )
        const newOwner = newOwners[key]

        /* ----------------------- Delete NFT Id Edge Display ----------------------- */
        await repositories.edge.hardDelete({ thatEntityId: nftId, edgeType: defs.EdgeType.Displays })

        /* ----------------------------- ERC1155 Update ----------------------------- */
        if (nftType === 'ERC1155') {
          const owners = await getOwnersForNFT2(nftChainId, nftContact, nftTokenId)
          if (owners.length > 1) {
            // This is ERC1155 token with multiple owners, so we don't update owner for now and delete NFT
            await repositories.edge.hardDelete({ thatEntityId: nftId }).then(() =>
              repositories.nft.hardDelete({
                id: nftId,
              }),
            )
            await seService.deleteNFT(nftId)
            logger.info(
              `filterNFTsWithMulticall 2b: userId=${
                nfts[0]?.userId || '-'
              } ${owner}, deleting nft ${nftId}, key=${key} ${new Date().getTime() - start}ms`,
            )
            start = new Date().getTime()
          }
        } else {
          /* ----------------------------- Non-ERC1155 Update ----------------------------- */
          const wallet = await repositories.wallet.findByChainAddress(nftChainId, newOwner)

          await repositories.nft.updateOneById(nftId, {
            userId: wallet?.userId || null, // null if user has not been created yet by connecting to NFT.com
            walletId: wallet?.id || null, // null if wallet has not been connected to NFT.com
            owner: newOwner,
          })

          await seService.indexNFTs(nftsToUpdate)
          logger.info(
            newOwners,
            `filterNFTsWithMulticall 3: userId=${
              nfts[0]?.userId || '-'
            } ${owner}, finished updating newNftOwnerKeys from old owner: ${owner}!, newOwners:${JSON.stringify(
              newOwners,
            )}, ${new Date().getTime() - start}ms`,
          )
          logger.info(
            missingOwners,
            `filterNFTsWithMulticall 4: userId=${nfts[0]?.userId || '-'} ${owner}, missingOwners = ${
              Object.keys(missingOwners).length
            }/${nfts.length} nfts, missingOwners:${JSON.stringify(missingOwners)}, ${new Date().getTime() - start}ms`,
          )
          start = new Date().getTime()
        }
      } else {
        logger.info(`filterNFTsWithMulticall 5: userId=${nfts[0]?.userId || '-'} ${owner}, no nftId for key ${key}!`)
      }
    })
  } catch (err) {
    logger.error(err, 'Error in filterNFTsWithMulticall -- top level')
    Sentry.captureMessage(`Error in filterNFTsWithMulticall: ${err}`)
    throw err
  }
}

const getNFTMetaDataFromAlchemy = async (
  contractAddress: string,
  tokenId: string,
  // optionalWeb3: (AlchemyWeb3 | undefined) = undefined,
): Promise<AlchemyNFTMetaDataResponse | undefined> => {
  try {
    const alchemyInstance: AxiosInstance = await getAlchemyInterceptor(process.env.CHAIN_ID)
    const queryParams = `contractAddress=${contractAddress}&tokenId=${tokenId}`
    const response: AxiosResponse = await alchemyInstance.get(`/getNFTMetadata?${queryParams}`)

    return response.data as AlchemyNFTMetaDataResponse
  } catch (err) {
    Sentry.captureMessage(`Error in getNFTMetaDataFromAlchemy: ${err}`)
    return undefined
  }
}

export const getContractMetaDataFromAlchemy = async (
  contractAddress: string,
): Promise<AlchemyContractMetaDataResponse | undefined> => {
  try {
    const key = `getContractMetaDataFromAlchemy${alchemyUrl}_${helper.checkSum(contractAddress)}`
    const cachedContractMetadata: string = await cache.get(key)

    if (cachedContractMetadata) {
      return JSON.parse(cachedContractMetadata)
    } else {
      const baseUrl = `${alchemyUrl}/getContractMetadata/?contractAddress=${contractAddress}`
      const response = await axios.get(baseUrl)

      if (response && response?.data) {
        await cache.set(key, JSON.stringify(response.data), 'EX', 60 * 60) // 1 hour
        return response.data
      } else {
        return undefined
      }
    }
  } catch (err) {
    Sentry.captureMessage(`Error in getContractMetaDataFromAlchemy: ${err}`)
    return undefined
  }
}

export const getCollectionNameFromContract = (
  contractAddress: string,
  chainId: string,
  type: defs.NFTType,
): Promise<string> => {
  try {
    if (type === defs.NFTType.ERC721) {
      const tokenContract = typechain.ERC721__factory.connect(contractAddress, provider.provider(Number(chainId)))
      return tokenContract.name().catch(() => Promise.resolve('Unknown Name'))
    } else if (type === defs.NFTType.ERC1155 || type === defs.NFTType.UNKNOWN) {
      const tokenContract = typechain.ERC1155__factory.connect(contractAddress, provider.provider(Number(chainId)))
      return tokenContract.name().catch(() => Promise.resolve('Unknown Name'))
    } else {
      logger.error('Token type not ERC721, ERC1155, nor UNKNOWN', type)
      return Promise.resolve('Unknown Name')
    }
  } catch (error) {
    logger.error('ethers failed: ', error)
    Sentry.captureException(error)
    Sentry.captureMessage(`Error in getCollectionNameFromContract: ${error}`)
    return Promise.resolve('Unknown Name')
  }
}

export const getNFTsForCollection = async (contractAddress: string): Promise<any> => {
  try {
    const key = `getNFTsForCollection${alchemyUrl}_${helper.checkSum(contractAddress)}`
    const cachedContractMetadata: string = await cache.get(key)

    const nfts = []
    if (cachedContractMetadata) {
      return JSON.parse(cachedContractMetadata)
    } else {
      const baseUrl = `${alchemyUrl}/getNFTsForCollection/?contractAddress=${contractAddress}&withMetadata=true`
      const response = await axios.get(baseUrl)

      if (response && response?.data) {
        if (response?.data?.nfts && response?.data?.nfts?.length) {
          nfts.push(...response.data.nfts)
          await cache.set(key, JSON.stringify(nfts), 'EX', 60 * 10) // 10 minutes
          return nfts
        } else {
          return undefined
        }
      }
    }
  } catch (err) {
    Sentry.captureMessage(`Error in getNFTsForCollection: ${err}`)
    return undefined
  }
}

export const batchCallTokenURI = async (
  tokens: Array<TokenRequest>,
  chainId: string,
): Promise<Array<string | undefined>> => {
  try {
    // Generate arguments for multicall based on schema (ERC721 or ERC1155)
    const multicallArgs = tokens.map(({ schema, contractAddress, tokenId }) => {
      return {
        contract: contractAddress,
        name: schema === 'erc721' ? 'tokenURI' : 'uri',
        params: [BigNumber.from(tokenId)],
      }
    })

    // Use multicall to batch fetch token URIs
    const tokenUris = await fetchDataUsingMulticall(
      multicallArgs,
      tokenUriAbi,
      chainId,
      false,
      provider.provider(Number(chainId)), // Web3 provider
    )

    // Extract token URIs from the response
    const uris = tokenUris.map(data => (data ? data[0] : undefined))

    return uris
  } catch (err) {
    logger.error(err, `Error in batchCallTokenURI ${err}`)
    return []
  }
}

const formatMetadata = (apiResponse: ApiResponse): Metadata => {
  try {
    const { animation_url, name, image, image_url, imageUrl, image_data, attributes, description } = apiResponse

    // Determine if attributes is an object or an array
    const isObject = attributes && typeof attributes === 'object' && !Array.isArray(attributes)
    const isArray = Array.isArray(attributes)

    // Handle attributes based on its type (object, array, or undefined)
    let traits = []
    if (isObject) {
      traits = Object.entries(attributes).map(([trait_type, value]) => ({ type: trait_type, value }))
    } else if (isArray) {
      traits = attributes.map(attr => ({ type: attr.trait_type, value: attr.value }))
    }

    return {
      name,
      image: image || image_url || image_data || animation_url || imageUrl || '',
      traits,
      description: description || null,
    }
  } catch (error) {
    logger.error(error, `Failed to format metadata: ${error}, raw: ${JSON.stringify(apiResponse)}`)
    return null
  }
}

// Function to get a random Infura credential
const getRandomInfuraCredential = (): { apiKey: string; secret: string } => {
  const randomIndex = Math.floor(Math.random() * infuraCredentials.length)
  return infuraCredentials[randomIndex]
}

// Function to attempt fetching data from IPFS with the provided URL
const fetchMetadataFromIPFSUrl = async (url: string, auth: string): Promise<string> => {
  const response = await fetch(url, {
    headers: {
      authorization: auth,
    },
    method: 'POST',
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch data from IPFS: ${response.statusText}`)
  }

  return await response.text()
}

const fetchDataFromIPFS = async (cid: string): Promise<string> => {
  const { apiKey, secret } = getRandomInfuraCredential()
  const auth = 'Basic ' + Buffer.from(apiKey + ':' + secret).toString('base64')
  const ipfsApiUrl = 'https://ipfs.infura.io:5001/api/v0/cat?arg='

  try {
    // Attempt to fetch metadata using the original CID
    return await fetchMetadataFromIPFSUrl(ipfsApiUrl + cid, auth)
  } catch (error) {
    logger.error('Error:', error.message)

    // Check if the CID ends with a hex token ID, with or without .json
    const hexTokenIdMatch = cid.match(/\/0x([0-9a-fA-F]+)(?:\.json)?$/)
    if (hexTokenIdMatch) {
      // Extract and convert hex token ID to zero-padded and plain number format
      const hexTokenId = hexTokenIdMatch[1]
      const numTokenId = parseInt(hexTokenId, 16).toString().padStart(64, '0')
      const plainNumTokenId = parseInt(hexTokenId, 16).toString()

      // Attempt to fetch metadata using zero-padded number token ID
      const zeroPaddedCid = cid.replace('0x' + hexTokenId, numTokenId)
      try {
        return await fetchMetadataFromIPFSUrl(ipfsApiUrl + zeroPaddedCid, auth)
      } catch (error) {
        logger.error('Error:', error.message)

        // If fetching with zero-padded number fails, try fetching with plain number
        const plainNumCid = cid.replace('0x' + hexTokenId, plainNumTokenId)
        return await fetchMetadataFromIPFSUrl(ipfsApiUrl + plainNumCid, auth)
      }
    }

    // If not a hex token ID, throw the original error
    throw error
  }
}

const getWithRetry = async (url: string, retries = 0): Promise<ApiResponse> => {
  try {
    const response = await axios.get(url)
    return response.data
  } catch (error) {
    if (error.response && error.response.status === 429) {
      if (retries < MAX_RETRIES) {
        const delayMs = INITIAL_DELAY_MS * Math.pow(2, retries)
        logger.debug(`Rate-limited. Retrying in ${delayMs} ms...`)
        await new Promise(resolve => setTimeout(resolve, delayMs))
        return getWithRetry(url, retries + 1)
      }
      logger.debug('Reached maximum retries. Aborting request.')
      throw error
    }
    throw error
  }
}

export const parseNFTUriString = async (uriString: string, tokenId?: string, csContract?: string): Promise<Metadata | null> => {
  try {
    // Handle OpenSea metadata API format with 0x{id} placeholder
    let resolvedUriString = uriString
    if (uriString.includes('0x{id}') && tokenId) {
      resolvedUriString = uriString.replace('0x{id}', tokenId) + '?format=json'
    } else if (uriString.includes('{id}') && tokenId) {
      if (uriString.includes('mikehager.de')) {
        const hexTokenWithoutPrefix = tokenId.replace(/^0x/, '')
        resolvedUriString = uriString.replace('{id}', hexTokenWithoutPrefix)
      } else {
        resolvedUriString = uriString.replace('{id}', tokenId)
      }
    }

    // Handle IPFS hash format (e.g., QmUpPCBsGayB41RWVn81NUmscZbmPHNQYzY7fyh2LVLkCV)
    if (/^Qm[a-zA-Z0-9]{44}$/.test(resolvedUriString)) {
      const content = await fetchDataFromIPFS(resolvedUriString)
      logInfoBatch.push(`[parseNFTUriString]: Fetched metadata from IPFS: ${resolvedUriString}, content: ${content}`)
      return formatMetadata(JSON.parse(content?.toString()))
    }

    if (resolvedUriString.startsWith('ipfs://')) {
      // Remove the 'ipfs://' prefix and also handle cases where 'ipfs/' is present after the prefix
      const cid = resolvedUriString.replace(/^ipfs:\/\/(ipfs\/)?/, '')
      const content = await fetchDataFromIPFS(cid)
      logInfoBatch.push(`[parseNFTUriString]: Fetched metadata from IPFS: ${cid}, content: ${content}`)
      return formatMetadata(JSON.parse(content?.toString()))
    }

    // Handle data:application/json;utf8, format
    if (resolvedUriString.startsWith('data:application/json;utf8,')) {
      // Extract JSON string from the data URI
      const jsonStr = resolvedUriString.replace('data:application/json;utf8,', '')
      // Parse and format the metadata
      const metadata = JSON.parse(jsonStr)
      logInfoBatch.push(`[parseNFTUriString]: Fetched metadata from JSON data: ${jsonStr}`)
      return formatMetadata(metadata)
    }

    if (resolvedUriString.startsWith('data:application/json;base64,')) {
      const base64Data = resolvedUriString.replace('data:application/json;base64,', '')
      const jsonStr = Buffer.from(base64Data, 'base64').toString()
      logInfoBatch.push(`[parseNFTUriString]: Fetched metadata from base64: ${jsonStr}`)
      return formatMetadata(JSON.parse(jsonStr))
    }

    // Handle data:application/json, format (without utf8 and base64 encoding)
    if (resolvedUriString.startsWith('data:application/json,')) {
      // Extract JSON string from the data URI
      const jsonStr = decodeURIComponent(resolvedUriString.replace('data:application/json,', ''))

      // Parse the JSON string into a metadata object
      const metadata = JSON.parse(jsonStr)
      logInfoBatch.push(`[parseNFTUriString]: Fetched metadata from JSON data: ${jsonStr}`)
      // Use the formatMetadata function to format the metadata object
      return formatMetadata(metadata)
    }

    // Handle https://, http://, and arweave URLs
    if (
      resolvedUriString.startsWith('https://') ||
      resolvedUriString.startsWith('http://') ||
      resolvedUriString.startsWith('https://arweave.net/')
    ) {
      // Check if URL is from OpenSea
      if (resolvedUriString.startsWith('https://opensea.io')) {
        // Fetch metadata using the OpenSea API
        const openseaInstance = getOpenseaInterceptor(resolvedUriString, chainId, process.env.OPENSEA_ORDERS_API_KEY)
        const response = await openseaInstance.get('')
        logInfoBatch.push(
          `[parseNFTUriString]: Fetched metadata from OpenSea API: ${resolvedUriString}, response: ${JSON.stringify(
            response.data,
          )}`,
        )
        return formatMetadata(response.data)
      } else {
        try {
          const response = await getWithRetry(resolvedUriString)
          logInfoBatch.push(
            `[parseNFTUriString]: Fetched metadata from URL: ${resolvedUriString}, response: ${JSON.stringify(
              response,
            )}`,
          )
          return formatMetadata(response)
        } catch (error) {
          // If fetching from the URL fails, check if it contains an IPFS hash and attempt to fetch from IPFS directly
          const ipfsRegex = /ipfs\/(Qm[a-zA-Z0-9]+)(?:\/(\d+))?\/?/
          const ipfsMatch = resolvedUriString.match(ipfsRegex)
          if (ipfsMatch) {
            const ipfsHash = ipfsMatch[1]
            const capturedTokenId = ipfsMatch[2]
            // Construct the IPFS URL with optional token ID
            const ipfsUrl = capturedTokenId ? `${ipfsHash}/${capturedTokenId}` : ipfsHash
            const content = await fetchDataFromIPFS(ipfsUrl)
            logInfoBatch.push(`Retrying and fetched metadata from IPFS: ${ipfsUrl}, content: ${content}`)
            return formatMetadata(JSON.parse(content?.toString()))
          }
          // If no IPFS hash found, throw the original error.
          throw error
        }
      }
    }

    // Handle ar:// format
    if (resolvedUriString.startsWith('ar://')) {
      // Extract the Arweave transaction ID and optional path from the ar:// URL
      const arweaveTxId = resolvedUriString.split('/')[2]
      const optionalPath = resolvedUriString.split('/').slice(3).join('/') || ''
      // Construct the Arweave data URL
      const arweaveUrl = `https://arweave.net/${arweaveTxId}/${optionalPath}`
      // Fetch metadata from Arweave
      const response = await axios.get<ApiResponse>(arweaveUrl)
      logInfoBatch.push(
        `[parseNFTUriString]: Fetched metadata from Arweave: ${arweaveUrl}, response: ${JSON.stringify(response.data)}`,
      )
      return formatMetadata(response.data)
    }

    // batched logs
    if (logInfoBatch.length >= BATCH_LOG_SIZE) {
      logger.info(logInfoBatch.join('\n'))
      logInfoBatch = []
    }

    throw new Error(`Unrecognized URI string format: ${resolvedUriString}`)
  } catch (error) {
    logger.error(error, `Failed to parse URI string: ${error}, ${uriString}, tokenId=${tokenId}, csContract=${csContract}`)
    return null
  }
}

/**
 * Gets the NFTs for a given official collection address.
 * @param {GetOfficialCollectionNFTsArgs} args - The arguments to pass to the function.
 * @returns {Promise<any>} The official collection NFTs.
 */
export const getNFTsForOfficialCollection = async ({
  chainId = process.env.CHAIN_ID,
  collectionAddress,
  offsetPageInput,
}: gql.OfficialCollectionNFTsInput): Promise<gql.OfficialCollectionNFTsOutput> => {
  const defaultCacheDuration = 12 * 60 * 60 * 1000 // 12hrs in ms
  // Validate args
  auth.verifyAndGetNetworkChain('ethereum', chainId)

  const [officialCollectionErr, officialCollection] = await fp.promiseTo(
    repositories.collection.findByContractAddress(
      ethersUtils.getAddress(collectionAddress),
      chainId,
      true, // Check if collection isOfficial
    ),
  )

  /// Error Handling
  if (officialCollectionErr || helper.isEmpty(officialCollection)) {
    throw appError.buildNotFound(
      nftError.buildNFTNotFoundMsg('official collection ' + collectionAddress + ' on chain ' + chainId),
      nftError.ErrorType.NFTNotFound,
    )
  }

  return await paginatedOffsetResultsFromEntitiesBy({
    repo: repositories.nft,
    offsetPageInput,
    filters: [{ contract: collectionAddress }],
    orderKey: 'id',
    orderDirection: 'DESC',
    select: {
      id: true,
      tokenId: true,
      updatedAt: true,
    },
    cache: defaultCacheDuration,
  })
}

export const getCollectionNameFromDataProvider = async (
  contract: string,
  chainId: string,
  type: defs.NFTType,
): Promise<string> => {
  try {
    const contractDetails: AlchemyContractMetaDataResponse = await getContractMetaDataFromAlchemy(contract)

    // priority to OS Collection Name from Alchemy before fetching name from contract
    if (contractDetails?.contractMetadata?.openSea?.collectionName) {
      return contractDetails?.contractMetadata?.openSea?.collectionName
    }

    if (contractDetails?.contractMetadata?.name) {
      return contractDetails?.contractMetadata?.name
    }
  } catch (error) {
    logger.error(`Error in getCollectionNameFromDataProvider: ${error}`)
    Sentry.captureException(error)
    Sentry.captureMessage(`Error in getCollectionNameFromDataProvider: ${error}`)
  }

  const nameFromContract: string = await getCollectionNameFromContract(contract, chainId, type)

  return nameFromContract
}

export const updateCollectionForNFTs = async (nfts: Array<entity.NFT>): Promise<void> => {
  try {
    const seen = {}
    const nonDuplicates: Array<entity.NFT> = []
    nfts.map((nft: entity.NFT) => {
      const key = helper.checkSum(nft.contract)
      if (!seen[key]) {
        nonDuplicates.push(nft)
        seen[key] = true
      }
    })
    // save collections...
    let collections = []

    await Promise.allSettled(
      nonDuplicates.map(async (nft: entity.NFT) => {
        const collection = await repositories.collection.findOne({
          where: { contract: helper.checkSum(nft.contract) },
        })
        if (!collection) {
          const collectionName = await getCollectionNameFromDataProvider(nft.contract, nft.chainId, nft.type)
          const collectionDeployer = await getCollectionDeployer(nft.contract, nft.chainId)
          logger.debug('new collection', { collectionName, contract: nft.contract, collectionDeployer })

          collections.push({
            contract: helper.checkSum(nft.contract),
            chainId: nft?.chainId || process.env.CHAIN_ID,
            name: collectionName,
            deployer: collectionDeployer,
          })
        }
      }),
    )
    collections = await repositories.collection.saveMany(collections, { chunk: MAX_SAVE_COUNTS })
    await seService.indexCollections(collections)

    // save edges for collection and nfts...
    const edges = []
    await Promise.allSettled(
      nfts.map(async nft => {
        const collection = await repositories.collection.findOne({
          where: { contract: helper.checkSum(nft.contract) },
        })
        if (collection) {
          const edgeVals = {
            thisEntityType: defs.EntityType.Collection,
            thatEntityType: defs.EntityType.NFT,
            thisEntityId: collection.id,
            thatEntityId: nft.id,
            edgeType: defs.EdgeType.Includes,
          }
          const edge = await repositories.edge.findOne({ where: edgeVals })
          if (!edge) edges.push(edgeVals)
        }
      }),
    )
    await repositories.edge.saveMany(edges, { chunk: MAX_SAVE_COUNTS })
  } catch (err) {
    logger.error(err, `Error in updateCollectionForNFTs: ${err}`)
    Sentry.captureMessage(`Error in updateCollectionForNFTs: ${err}`)
    return err
  }
}

// traits with rarity
export const nftTraitBuilder = (
  nftAttributes: defs.Trait[],
  rarityAttributes: NFTPortRarityAttributes[],
): defs.Trait[] => {
  const traits: defs.Trait[] = []
  if (nftAttributes.length) {
    for (const attribute of nftAttributes) {
      const traitExists: NFTPortRarityAttributes = rarityAttributes.find((rarityAttribute: NFTPortRarityAttributes) => {
        if (
          rarityAttribute?.trait_type === attribute?.type &&
          String(rarityAttribute?.value || '').trim() === String(attribute?.value || '').trim()
        ) {
          return rarityAttribute
        }
      })
      let traitsToBePushed: defs.Trait = {
        ...attribute,
      }

      if (traitExists) {
        traitsToBePushed = {
          ...traitsToBePushed,
          type: traitExists?.trait_type || attribute?.type || '',
          value: traitExists?.value || attribute?.value || '',
        }
        if (traitExists?.statistics?.prevalence) {
          traitsToBePushed = {
            ...traitsToBePushed,
            rarity: String(traitExists.statistics.prevalence || '0'),
          }
        }
      }

      traits.push(traitsToBePushed)
    }
  }
  return traits
}

enum MetadataProvider {
  Alchemy = 'alchemy',
  NFTPort = 'nftport',
  All = 'all',
}

// helper function to get traits for metadata, nftPort optional
export const getMetadataTraits = (alchemyMetadata: any, nftPortDetails: NFTPortNFT = undefined): Array<defs.Trait> => {
  const traits: Array<defs.Trait> = []

  if (Array.isArray(alchemyMetadata?.attributes)) {
    alchemyMetadata?.attributes.map(trait => {
      let value = trait?.value || trait?.trait_value
      value = typeof value === 'string' ? value : JSON.stringify(value)
      traits.push({
        type: trait?.trait_type,
        value,
      })
    })
  } else if (Array.isArray(alchemyMetadata?.message?.attributes)) {
    // edge case for alchemy
    alchemyMetadata?.message?.attributes.map(trait => {
      let value = trait?.value || trait?.trait_value
      value = typeof value === 'string' ? value : JSON.stringify(value)
      traits.push({
        type: trait?.trait_type,
        value,
      })
    })
  } else if (Array.isArray(alchemyMetadata?.enhanced_cattributes)) {
    alchemyMetadata?.enhanced_cattributes.map(trait => {
      let value = trait?.description
      value = typeof value === 'string' ? value : JSON.stringify(value)
      traits.push({
        type: trait?.type,
        value,
      })
    })
  } else if (Array.isArray(nftPortDetails?.nft?.metadata?.attributes)) {
    // nftport fallback
    nftPortDetails?.nft?.metadata?.attributes.map(trait => {
      let value = trait?.value || trait?.trait_value
      value = typeof value === 'string' ? value : JSON.stringify(value)
      traits.push({
        type: trait?.trait_type,
        value,
      })
    })
  } else {
    if (alchemyMetadata?.attributes) {
      Object.keys(alchemyMetadata?.attributes).map(keys => {
        let value = alchemyMetadata?.attributes?.[keys]
        value = typeof value === 'string' ? value : JSON.stringify(value)
        traits.push({
          type: keys,
          value,
        })
      })
    }
  }

  if (Array.isArray(nftPortDetails?.nft?.attributes)) {
    return nftTraitBuilder(traits, nftPortDetails?.nft?.attributes)
  }

  return traits
}

export const getNftName = (
  alchemyMetadata: AlchemyNFTMetaDataResponse,
  nftPortDetails: NFTPortNFT = undefined,
  alchemyContractMetadata: AlchemyContractMetaData = undefined,
  tokenId: string = undefined,
  metadataProvider: MetadataProvider = MetadataProvider.All, // by default gets all
): string => {
  logger.debug(
    `=======> getNftName: ${JSON.stringify(alchemyMetadata)}, ${JSON.stringify(nftPortDetails)}, ${JSON.stringify(
      alchemyContractMetadata,
    )}, ${tokenId}, ${metadataProvider}`,
  )
  const tokenName = tokenId
    ? [
        `${alchemyContractMetadata?.name || alchemyContractMetadata?.openSea?.collectionName || ''}`,
        `#${BigNumber.from(tokenId).toString()}`,
      ].join(' ')
    : ''

  if (metadataProvider === MetadataProvider.Alchemy) {
    return alchemyMetadata?.title || alchemyMetadata?.metadata?.name || tokenName
  } else if (metadataProvider === MetadataProvider.NFTPort) {
    return nftPortDetails?.nft?.metadata?.name || tokenName
  }

  // default
  return nftPortDetails?.nft?.contract_address?.toLowerCase() == CRYPTOPUNK
    ? nftPortDetails?.nft?.metadata?.name
    : alchemyMetadata?.title || alchemyMetadata?.metadata?.name || nftPortDetails?.nft?.metadata?.name || tokenName
}

export const getNftDescription = (
  alchemyMetadata: AlchemyNFTMetaDataResponse,
  nftPortDetails: NFTPortNFT = undefined,
  alchemyContractMetadata: AlchemyContractMetaData = undefined,
  metadataProvider: MetadataProvider = MetadataProvider.All, // by default gets all
): string => {
  if (metadataProvider === MetadataProvider.Alchemy) {
    return alchemyMetadata?.description || alchemyContractMetadata?.openSea?.description
  } else if (metadataProvider === MetadataProvider.NFTPort) {
    return nftPortDetails?.nft?.metadata?.description
  }

  // default
  return (
    alchemyMetadata?.description ||
    alchemyContractMetadata?.openSea?.description ||
    nftPortDetails?.nft?.metadata?.description
  )
}

const FALLBACK_IMAGE_URL = process.env.FALLBACK_IMAGE_URL || 'https://cdn.nft.com/optimizedLoader2.webp'
export const getNftImage = async (
  alchemyNFT: AlchemyNFTMetaDataResponse,
  nftPortDetails: NFTPortNFT = undefined,
  alchemyContractMetadata: AlchemyContractMetaData = undefined,
  metadataProvider: MetadataProvider = MetadataProvider.All, // by default gets all
): Promise<string> => {
  const alchemyMetadata = alchemyNFT?.metadata

  if (alchemyNFT) {
    const isNftProfile =
      alchemyNFT.contract.address.toLowerCase() === contracts.nftProfileAddress(chainId).toLowerCase()
    if (isNftProfile && alchemyMetadata?.name) {
      logger.info(
        `=======> getNftImage: ${JSON.stringify(alchemyNFT)}, ${JSON.stringify(nftPortDetails)}, ${JSON.stringify(
          alchemyContractMetadata,
        )}, ${metadataProvider}`,
      )
      const internalProfile = await repositories.profile.findOne({
        where: {
          url: alchemyMetadata?.name,
        },
      })

      if (internalProfile) {
        logger.info(`=======> getNftImage: ${internalProfile.photoURL}`)
        return internalProfile?.photoURL
      }
    }
  }

  if (metadataProvider === MetadataProvider.Alchemy) {
    return (
      alchemyMetadata?.image ||
      alchemyNFT?.tokenUri?.gateway ||
      alchemyNFT?.tokenUri?.raw ||
      (alchemyContractMetadata?.openSea?.imageUrl ?? FALLBACK_IMAGE_URL)
    )
  } else if (metadataProvider === MetadataProvider.NFTPort) {
    return nftPortDetails?.nft?.cached_file_url
  }

  // default
  return alchemyMetadata?.image?.includes('copebear') ||
    nftPortDetails?.nft?.contract_address?.toLowerCase() == CRYPTOPUNK
    ? nftPortDetails?.nft?.cached_file_url
    : alchemyMetadata?.image ||
        alchemyNFT?.tokenUri?.gateway ||
        alchemyNFT?.tokenUri?.raw ||
        nftPortDetails?.nft?.cached_file_url ||
        FALLBACK_IMAGE_URL
}

export const getNftType = (
  alchemyMetadata: AlchemyNFTMetaDataResponse,
  nftPortDetails: NFTPortNFT = undefined,
  contractMetadata: AlchemyContractMetaData = undefined,
  metadataProvider: MetadataProvider = MetadataProvider.All, // by default gets all
): defs.NFTType | undefined => {
  if (metadataProvider === MetadataProvider.Alchemy) {
    if (alchemyMetadata?.id?.tokenMetadata?.tokenType === 'CRYPTO_PUNKS') {
      return defs.NFTType.CRYPTO_PUNKS
    } else if (alchemyMetadata?.id?.tokenMetadata?.tokenType === 'ERC721') {
      return defs.NFTType.ERC721
    } else if (alchemyMetadata?.id?.tokenMetadata?.tokenType === 'ERC1155') {
      return defs.NFTType.ERC1155
    } else if (alchemyMetadata?.title?.endsWith('.eth')) {
      // if token is ENS token...
      return defs.NFTType.UNKNOWN
    } else if (contractMetadata?.tokenType) {
      if (contractMetadata?.tokenType === 'ERC721') {
        return defs.NFTType.ERC721
      } else if (contractMetadata?.tokenType === 'ERC1155') {
        return defs.NFTType.ERC1155
      } else if (contractMetadata?.name?.endsWith('.eth')) {
        // if token is ENS token...
        return defs.NFTType.UNKNOWN
      }
    } else {
      logger.error({ alchemyMetadata, nftPortDetails }, 'Unknown NFT type')
      return undefined
    }
  } else if (metadataProvider === MetadataProvider.NFTPort) {
    if (
      nftPortDetails?.contract?.type == 'CRYPTO_PUNKS' ||
      nftPortDetails?.nft?.contract_address?.toLowerCase() == CRYPTOPUNK
    ) {
      return defs.NFTType.CRYPTO_PUNKS
    } else if (nftPortDetails?.contract?.type === 'ERC721') {
      return defs.NFTType.ERC721
    } else if (nftPortDetails?.contract?.type === 'ERC1155') {
      return defs.NFTType.ERC1155
    } else if (nftPortDetails?.nft?.metadata?.name?.endsWith('.eth')) {
      // if token is ENS token...
      return defs.NFTType.UNKNOWN
    } else {
      logger.error({ alchemyMetadata, nftPortDetails }, 'Unknown NFT type')
      return undefined
    }
  }

  // default
  if (
    nftPortDetails?.contract?.type == 'CRYPTO_PUNKS' ||
    nftPortDetails?.nft?.contract_address?.toLowerCase() == CRYPTOPUNK
  ) {
    return defs.NFTType.CRYPTO_PUNKS
  } else if (
    (alchemyMetadata?.id?.tokenMetadata?.tokenType || contractMetadata?.tokenType || nftPortDetails?.contract?.type) ===
    'ERC721'
  ) {
    return defs.NFTType.ERC721
  } else if (
    (alchemyMetadata?.id?.tokenMetadata?.tokenType || contractMetadata?.tokenType || nftPortDetails?.contract?.type) ===
    'ERC1155'
  ) {
    return defs.NFTType.ERC1155
  } else if (
    alchemyMetadata?.title?.endsWith('.eth') ||
    contractMetadata?.name?.endsWith('.eth') ||
    nftPortDetails?.nft?.metadata?.name?.endsWith('.eth')
  ) {
    // if token is ENS token...
    return defs.NFTType.UNKNOWN
  } else {
    logger.error({ alchemyMetadata, nftPortDetails }, 'Unknown NFT type')
    return undefined
  }
}

export const getNFTMetaData = async (
  contract: string,
  tokenId: string,
  chainId: string,
  refreshMetadata = true,
  onlyNftPort = false, // if true, processes only nftPort
  onlyAlchemy = false, // if true, processes only alchemy
): Promise<NFTMetaData | undefined> => {
  try {
    if (onlyNftPort) {
      // useful for cron based updates -> when we don't want to get bogged behind nft port rate limits
      const nftPortMetadata = await retrieveNFTDetailsNFTPort(
        contract,
        tokenId,
        chainId || process.env.CHAIN_ID,
        refreshMetadata,
      )

      logger.info(
        {
          contract,
          tokenId,
          chainId,
          refreshMetadata,
          onlyNftPort,
          onlyAlchemy,
        },
        `====> nftService.getNFTMetaData() nftportonly, contract=${contract}, tokenId=${tokenId}, onlyNftPort=${onlyNftPort}, onlyAlchemy=${onlyAlchemy}, nftPortMetadata=${JSON.stringify(
          nftPortMetadata,
        )}`,
      )

      const contractAlchemyMetadata = await getContractMetaDataFromAlchemy(contract)

      const name = getNftName(
        undefined,
        nftPortMetadata,
        contractAlchemyMetadata?.contractMetadata,
        tokenId,
        MetadataProvider.NFTPort,
      )
      const description = getNftDescription(
        undefined,
        nftPortMetadata,
        contractAlchemyMetadata?.contractMetadata,
        MetadataProvider.NFTPort,
      )
      const image = await getNftImage(
        undefined,
        nftPortMetadata,
        contractAlchemyMetadata?.contractMetadata,
        MetadataProvider.NFTPort,
      )

      const type: defs.NFTType = getNftType(
        undefined,
        nftPortMetadata,
        contractAlchemyMetadata?.contractMetadata,
        MetadataProvider.NFTPort,
      )
      if (!type) {
        // If it's missing NFT token type, we should throw error
        logger.error(`token type of NFT is wrong for contract ${contract} and tokenId ${tokenId}`)
        return Promise.reject(`token type of NFT is wrong for contract ${contract} and tokenId ${tokenId}`)
      }

      const traits: Array<defs.Trait> = getMetadataTraits(undefined, nftPortMetadata)

      return {
        type,
        name,
        description,
        image,
        traits,
      }
    } else {
      // Useful for non cron based updates -> like individual metadata refresh
      const alchemyMetadata: AlchemyNFTMetaDataResponse = await getNFTMetaDataFromAlchemy(contract, tokenId)

      const nftPortMetadata = onlyAlchemy
        ? undefined
        : await retrieveNFTDetailsNFTPort(contract, tokenId, chainId || process.env.CHAIN_ID, refreshMetadata)

      const contractAlchemyMetadata = await getContractMetaDataFromAlchemy(contract)

      const name = getNftName(alchemyMetadata, nftPortMetadata, contractAlchemyMetadata?.contractMetadata, tokenId)
      const description = getNftDescription(alchemyMetadata, nftPortMetadata, contractAlchemyMetadata?.contractMetadata)
      const image = await getNftImage(alchemyMetadata, nftPortMetadata, contractAlchemyMetadata?.contractMetadata)

      const type: defs.NFTType = getNftType(alchemyMetadata, nftPortMetadata, contractAlchemyMetadata?.contractMetadata)
      if (!type) {
        // If it's missing NFT token type, we should throw error
        logger.error(`token type of NFT is wrong for contract ${contract} and tokenId ${tokenId}`)
        return Promise.reject(`token type of NFT is wrong for contract ${contract} and tokenId ${tokenId}`)
      }

      const traits: Array<defs.Trait> = getMetadataTraits(alchemyMetadata?.metadata, nftPortMetadata)

      logger.info(
        {
          alchemyMetadata,
          nftPortMetadata,
          contract,
          tokenId,
          chainId,
          refreshMetadata,
          onlyNftPort,
          onlyAlchemy,
          name,
          description,
          image,
          type,
          traits,
        },
        `====> nftService.getNFTMetaData(), contract=${contract}, tokenId=${tokenId}, onlyNftPort=${onlyNftPort}, onlyAlchemy=${onlyAlchemy}, nftPortMetadata=${JSON.stringify(
          nftPortMetadata,
        )}`,
      )

      return {
        type,
        name,
        description,
        image,
        traits,
      }
    }
  } catch (err) {
    logger.error(`Error in getNFTMetaData: ${err}`)
    Sentry.captureMessage(`Error in getNFTMetaData: ${err}`)
    throw err
  }
}

/**
 * Upload buffer from external image url to our S3 and return CDN path
 * @param imageUrl
 * @param filename
 * @param chainId
 * @param contract
 * @param uploadPath
 */

const uploadImageToS3 = async (
  imageUrl: string,
  filename: string,
  chainId: string,
  contract: string,
  uploadPath: string,
): Promise<string | undefined> => {
  try {
    let buffer
    let ext
    let imageKey
    if (!imageUrl) return undefined
    // We skip previewLink generation for SVG, GIF, MP4 and MP3
    if (imageUrl.indexOf('data:image/svg+xml') === 0) {
      // File Format not acceptable
      logger.log(`File format not acceptable for ${imageUrl}`)
      return null
    } else {
      imageUrl = processIPFSURL(imageUrl)
      ext = extensionFromFilename(filename)

      if (!ext) {
        if (imageUrl.includes('https://metadata.ens.domains/')) {
          // this image is svg so we skip it
          logger.log(`ENS file format not acceptable for ${imageUrl}`)
          return null
        } else if (imageUrl.includes('https://arweave.net/')) {
          // AR images are mp4 format, so we don't save as preview link
          logger.log(`Arweave file format is unacceptable for ${imageUrl}`)
          return null
        } else {
          ext = 'png'
          imageKey = uploadPath + Date.now() + '-' + filename + '.png'
        }
      } else {
        if (ext === 'mp4' || ext === 'gif' || ext === 'svg' || ext === 'mp3') {
          logger.log(`File format is unacceptable for ${imageUrl}`)
          return null
        } else {
          imageKey = uploadPath + Date.now() + '-' + filename
        }
      }

      // get buffer from imageURL, timeout is set to 60 seconds
      const res = await fetchWithTimeout(imageUrl, { timeout: 1000 * 60 })
      buffer = await res.buffer()
    }

    if (!buffer) return undefined

    const contentType = contentTypeFromExt(ext)
    if (!contentType) return undefined
    const s3config = await getAWSConfig()
    const upload = new Upload({
      client: s3config,
      params: {
        Bucket: assetBucket.name,
        Key: imageKey,
        Body: buffer,
        ContentType: contentType,
      },
    })
    await upload.done()

    logger.info(`finished uploading in uploadImageToS3: ${imageUrl}`)
    return s3ToCdn(`https://${assetBucket.name}.s3.amazonaws.com/${imageKey}`)
  } catch (err) {
    logger.error(`Error in uploadImageToS3 ${err}`)
    Sentry.captureMessage(`Error in uploadImageToS3 ${err}`)

    // error should not be thrown, just logged
    return null
  }
}

export const updateNFTOwnershipAndMetadata = async (
  inputNft: AlchemyNFTMetaDataResponse,
  userId: string,
  wallet: entity.Wallet,
  chainId: string,
): Promise<entity.NFT | undefined> => {
  try {
    let start = new Date().getTime()

    let nft = inputNft
    const containsMetadata = inputNft?.metadata != undefined || inputNft?.contractMetadata != undefined

    logger.info(
      `0a. started fetching existingNFT in updateNFTOwnershipAndMetadata, containsMetadata: ${containsMetadata}, inputNft: ${JSON.stringify(
        inputNft,
      )}`,
    )

    // useful for refreshNFT, where inputNFT doesn't contain metadata / contract metadata
    // therefore we must repull and fill in nft object
    if (!containsMetadata && inputNft?.contract?.address && inputNft?.id?.tokenId) {
      const alchemyMetadata: AlchemyNFTMetaDataResponse = await getNFTMetaDataFromAlchemy(
        inputNft?.contract?.address,
        inputNft?.id?.tokenId,
      )
      const contractAlchemyMetadata = await getContractMetaDataFromAlchemy(inputNft?.contract.address)
      nft = {
        ...alchemyMetadata,
        contractMetadata: contractAlchemyMetadata.contractMetadata,
      }
      logger.info(
        `0b. finished fetching existingNFT in updateNFTOwnershipAndMetadata: ${
          new Date().getTime() - start
        }ms, nft=${JSON.stringify(nft)}`,
      )
    }

    const existingNFT = await repositories.nft.findOne({
      where: {
        contract: helper.checkSum(nft.contract.address),
        tokenId: BigNumber.from(nft.id.tokenId).toHexString(),
        chainId: chainId,
      },
    })
    logger.info(
      `1. finished fetching existingNFT in updateNFTOwnershipAndMetadata: ${new Date().getTime() - start}ms, nft=${
        nft.contract.address
      }, tokenId=${nft.id.tokenId}`,
    )
    start = new Date().getTime()

    const walletChainId = wallet?.chainId || process.env.CHAIN_ID

    let name = getNftName(nft, undefined, nft.contractMetadata, nft.id.tokenId, MetadataProvider.Alchemy)
    let type = getNftType(nft, undefined, nft.contractMetadata, MetadataProvider.Alchemy)
    let description = getNftDescription(nft, undefined, nft.contractMetadata, MetadataProvider.Alchemy)
    let image = await getNftImage(nft, undefined, nft.contractMetadata, MetadataProvider.Alchemy)
    let traits = getMetadataTraits(nft.metadata, undefined)

    logger.info(
      `2. finished fetching name, image, description, traits in updateNFTOwnershipAndMetadata: ${
        new Date().getTime() - start
      }ms, nft=${nft.contract.address}, tokenId=${nft.id.tokenId}`,
    )
    start = new Date().getTime()

    let undefinedCount = 0
    if (!type) undefinedCount++
    if (!name) undefinedCount++
    if (!description) undefinedCount++
    if (!image) undefinedCount++
    if (!traits.length) undefinedCount++

    // if we are not available to get nft metadata from getNFTs api, we try to get information from getNFTMetadata or NFTPort
    if (undefinedCount >= 3) {
      // get redis count for nft.contract.address
      const redisCount = await cache.zscore(`update_metadata_cron_${chainId}`, nft.contract.address)

      // only do 5 updates until skipping
      if (!redisCount || (redisCount && parseInt(redisCount) < 3)) {
        logger.info(
          {
            redisCount: redisCount || 1,
            contract: nft.contract.address,
            tokenId: nft.id.tokenId,
          },
          `3. NFT metadata is not available from getNFTs api, trying to get from getNFTMetadata or NFTPort... redisCount=${redisCount}, type=${type}, name=${name}, description=${description}, image=${image}, traits=${traits.length}`,
        )
        const onlyNftPort = true // we want nft port data bc alchemy data up till this point has failed

        // space it apart
        await delay(100)
        const metadata = await getNFTMetaData(nft.contract.address, nft.id.tokenId, walletChainId, onlyNftPort)
        if (!metadata) {
          logger.info(
            `4. NFT metadata is not available from getNFTMetadata or NFTPort...${JSON.stringify(nft)}, nft=${
              nft.contract.address
            }, tokenId=${nft.id.tokenId}`,
          )
          await refreshContractAlchemy(nft.contract.address)
          return undefined
        }
        type = metadata.type
        name = metadata.name
        description = metadata.description
        image ??= metadata.image
        traits = metadata.traits
        logger.info(
          `5. NFT metadata is successfully retrieved from getNFTMetadata or NFTPort...${JSON.stringify(
            nft,
          )}, metadata=${JSON.stringify(metadata)}, nft=${nft.contract.address}, tokenId=${nft.id.tokenId}`,
        )
      } else {
        // if we are not able to get metadata from getNFTs api, we try to get metadata from getNFTMetadata or NFTPort for 5 times
        logger.info(
          {
            redisCount: redisCount || 1,
            wallet: wallet.address,
          },
          `[exceeded redis limit] - NFT metadata is not available from getNFTs api ${JSON.stringify(nft)}`,
        )
        return undefined
      }

      // running tracker of bad metadata
      await cache.zadd(`update_metadata_cron_${chainId}`, 'INCR', 1, nft.contract.address)
    }

    logger.info(
      `6. finished fetching metadata in updateNFTOwnershipAndMetadata: ${new Date().getTime() - start}ms, nft=${
        nft.contract.address
      }, tokenId=${nft.id.tokenId}`,
    )
    start = new Date().getTime()

    // if this NFT is not existing on our db, we save it...
    if (!existingNFT) {
      const csOwner = helper.checkSum(wallet.address)
      const savedNFT = await repositories.nft.save({
        chainId: walletChainId,
        userId,
        walletId: wallet.id,
        owner: csOwner,
        contract: helper.checkSum(nft.contract.address),
        tokenId: BigNumber.from(nft.id.tokenId).toHexString(),
        type,
        metadata: {
          name,
          description,
          imageURL: image,
          traits: traits,
        },
      })
      logger.info(
        `7. finished saving nft in updateNFTOwnershipAndMetadata: ${new Date().getTime() - start}ms, nft=${
          nft.contract.address
        }, tokenId=${nft.id.tokenId}`,
      )
      return savedNFT
    } else {
      // if this NFT is existing and owner changed, we change its ownership...
      if (existingNFT.userId !== userId || existingNFT.walletId !== wallet.id) {
        // we remove edge of previous profile
        await repositories.edge.hardDelete({ thatEntityId: existingNFT.id, edgeType: defs.EdgeType.Displays })

        logger.info(
          `7b. finished deleting old owner edges in updateNFTOwnershipAndMetadata: ${
            new Date().getTime() - start
          }ms, oldOwnerUserId=${existingNFT.userId} (${existingNFT.walletId}), newUserId=${userId} (${
            wallet.id
          }), nft=${nft.contract.address}, tokenId=${nft.id.tokenId}`,
        )

        // if this NFT is a profile NFT...
        if (helper.checkSum(existingNFT.contract) == helper.checkSum(contracts.nftProfileAddress(chainId))) {
          const previousWallet = await repositories.wallet.findById(existingNFT.walletId)

          if (previousWallet) {
            const profile = await repositories.profile.findOne({
              where: {
                tokenId: BigNumber.from(existingNFT.tokenId).toString(),
                ownerWalletId: previousWallet.id,
                ownerUserId: previousWallet.userId,
              },
            })
            // if this NFT was previous owner's preferred profile...
            if (profile && profile?.id === previousWallet.profileId) {
              await repositories.wallet.updateOneById(previousWallet.id, {
                profileId: null,
              })
            }
          } else {
            logger.info(
              `8. previous wallet for existing NFT ${existingNFT.id} is undefined, nft=${nft.contract.address}, tokenId=${nft.id.tokenId}`,
            )
          }
        }

        const csOwner = helper.checkSum(wallet.address)
        const updatedNFT = await repositories.nft.updateOneById(existingNFT.id, {
          userId,
          walletId: wallet.id,
          owner: csOwner,
          type,
          profileId: null,
          metadata: {
            name,
            description,
            imageURL: image,
            traits: traits,
          },
        })
        logger.info(
          `9. finished updating nft in updateNFTOwnershipAndMetadata: ${new Date().getTime() - start}ms, nft=${
            nft.contract.address
          }, tokenId=${nft.id.tokenId}`,
        )
        return updatedNFT
      } else {
        const csOwner = helper.checkSum(wallet.address)

        const isTraitSame =
          existingNFT.metadata.traits.length == traits.length &&
          existingNFT.metadata.traits.every(function (element, index) {
            return element.type === traits[index].type && element.value === traits[index].value
          })
        // if ownership's not changed and just metadata changed, we update only metadata...
        if (
          existingNFT.type !== type ||
          existingNFT.metadata.name !== name ||
          existingNFT.metadata.description !== description ||
          existingNFT.metadata.imageURL !== image ||
          helper.checkSum(existingNFT.owner) != csOwner ||
          !isTraitSame
        ) {
          const updatedNFT = await repositories.nft.updateOneById(existingNFT.id, {
            userId,
            walletId: wallet.id,
            owner: csOwner,
            type,
            metadata: {
              name,
              description,
              imageURL: image,
              traits: traits,
            },
          })
          logger.info(
            `10. finished updating nft in updateNFTOwnershipAndMetadata: ${new Date().getTime() - start}ms, nft=${
              nft.contract.address
            }, tokenId=${nft.id.tokenId}`,
          )
          return updatedNFT
        } else {
          logger.info(
            `11. finished updating nft in updateNFTOwnershipAndMetadata: ${new Date().getTime() - start}ms, nft=${
              nft.contract.address
            }, tokenId=${nft.id.tokenId}, existingNFT=${JSON.stringify(
              existingNFT,
            )}, image=${image}, name=${name}, description=${description}, traits=${JSON.stringify(
              traits,
            )}, isTraitSame=${isTraitSame}`,
          )
          return undefined
        }
      }
    }
  } catch (err) {
    logger.log(err)
    Sentry.captureMessage(`Error in updateNFTOwnershipAndMetadata: ${err}`)
    return undefined
  }
}

export const indexNFTsOnSearchEngine = async (nfts: Array<entity.NFT>): Promise<void> => {
  try {
    await seService.indexNFTs(nfts)
  } catch (err) {
    logger.error(`Error in indexNFTsOnSearchEngine: ${err}`)
    Sentry.captureMessage(`Error in indexNFTsOnSearchEngine: ${err}`)
    throw err
  }
}

export const indexCollectionsOnSearchEngine = async (collections: Array<entity.Collection>): Promise<void> => {
  try {
    await seService.indexCollections(collections)
  } catch (err) {
    logger.error(`Error in indexCollectionsOnSearchEngine: ${err}`)
    Sentry.captureMessage(`Error in indexCollectionsOnSearchEngine: ${err}`)
    throw err
  }
}

const getRelativeTime = (timestamp: number): string => {
  const now = Date.now()
  const diff = timestamp - now

  if (diff < 0) {
    return 'just now'
  } else if (diff < 1000) {
    return 'in less than a second'
  } else if (diff < 60 * 1000) {
    return 'in ' + Math.floor(diff / 1000) + ' seconds'
  } else if (diff < 60 * 60 * 1000) {
    return 'in ' + Math.floor(diff / (60 * 1000)) + ' minutes'
  } else if (diff < 24 * 60 * 60 * 1000) {
    return 'in ' + Math.floor(diff / (60 * 60 * 1000)) + ' hours'
  } else {
    return 'in ' + Math.floor(diff / (24 * 60 * 60 * 1000)) + ' days'
  }
}

/**
 * update wallet NFTs using data from alchemy api
 * @param userId
 * @param wallet
 * @param chainId
 * @param excludeSpam (default: true, nobody likes spam)
 * @param excludeAirdrops (default: false, optionally include to remove airdrops)
 */
export const updateWalletNFTs = async (
  userId: string,
  wallet: entity.Wallet,
  chainId: string,
  excludeSpam = true,
  excludeAirdrops = false,
): Promise<void> => {
  try {
    await removeExpiredTimestampedZsetMembers('update_nftService.updateWalletNFTs')

    const walletRecentlyUpdated = await cache.zscore('update_nftService.updateWalletNFTs', wallet.address)

    if (!walletRecentlyUpdated) {
      let start = new Date().getTime()
      logger.info(`[updateWalletNFTs] Updating wallet NFTs for ${wallet.address}, ${userId}`)
      let pageKey = undefined
      let totalPages = 0
      do {
        const [ownedNFTs, nextPageKey] = await getNFTsFromAlchemyPage(wallet.address, {
          pageKey,
          excludeAirdrops,
          excludeSpam,
        })
        pageKey = nextPageKey
        totalPages++

        /* --------------------------- synchronous updates -------------------------- */
        let savedNFTs: entity.NFT[] = []
        for (const nft of ownedNFTs) {
          try {
            const savedNFT = await updateNFTOwnershipAndMetadata(nft, userId, wallet, chainId)
            if (savedNFT) savedNFTs.push(savedNFT)
            start = new Date().getTime()
          } catch (err) {
            logger.error(
              { err, totalOwnedNFTs: ownedNFTs.length, userId, wallet },
              `[updateWalletNFTs] error 1: ${err}`,
            )
            Sentry.captureMessage(`[updateWalletNFTs] error 1: ${err}`)
          }
        }

        if (savedNFTs.length) {
          await updateCollectionForNFTs(savedNFTs) // we're awaiting for the sake of a test
          indexNFTsOnSearchEngine(savedNFTs)
          logger.info(
            `[updateWalletNFTs] Updating collection and Syncing search index for wallet ${wallet.address}, ${userId}, ${
              savedNFTs.length
            } NFTs, took ${new Date().getTime() - start}ms`,
          )
        }

        savedNFTs = []
        /* ------------------------------ end of insert ----------------------------- */
      } while (pageKey)

      const now: Date = new Date()
      const oneMinute = 60000
      if (totalPages < 3) {
        // 300 nfts
        now.setMilliseconds(now.getMilliseconds() + oneMinute)
      } else if (totalPages < 5) {
        // 500 nfts
        now.setMilliseconds(now.getMilliseconds() + oneMinute * 2)
      } else if (totalPages < 10) {
        // 1000 nfts
        now.setMilliseconds(now.getMilliseconds() + oneMinute * 10)
      } else if (totalPages < 20) {
        // 2000 nfts
        now.setMilliseconds(now.getMilliseconds() + oneMinute * 20)
      } else {
        now.setMilliseconds(now.getMilliseconds() + oneMinute * 30)
      }

      const ttl = now.getTime()
      await cache.zadd('update_nftService.updateWalletNFTs', ttl, wallet.address)
    } else {
      logger.info(
        `[updateWalletNFTs] wallet ${wallet.address} was recently updated, can resync NFTs in ${getRelativeTime(
          Number(walletRecentlyUpdated),
        )}, skipping`,
      )
    }
  } catch (err) {
    logger.error(`[updateWalletNFTs] error 2: ${err}`)
    Sentry.captureMessage(`[updateWalletNFTs] error 2: ${err}`)
  }
}

const batchFilterNFTsWithMulticall = async (nfts, walletAddress): Promise<void> => {
  const nftsChunks: entity.NFT[][] = chunk(nfts, 1000)
  await Promise.allSettled(
    nftsChunks.map(async (nftChunk: entity.NFT[]) => {
      try {
        await filterNFTsWithMulticall(nftChunk, walletAddress)
      } catch (err) {
        logger.error(`Error in checkNFTContractAddresses: ${err}`)
        Sentry.captureMessage(`Error in checkNFTContractAddresses: ${err}`)
      }
    }),
  )
}
/**
 * Gets all the NFTs in the database owned by this user,
 * and cross-references them with new Alchemy data.
 */
export const checkNFTContractAddresses = async (
  userId: string,
  walletId: string,
  walletAddress: string,
  chainId: string,
): Promise<void> => {
  try {
    const start = performance.now()
    logger.info({ userId, walletId, walletAddress, chainId }, 'checkNFTContractAddresses starting')
    let batchIteration = 0
    const pgClient = db.getPgClient(true)
    const nfts: entity.NFT[] = (
      await pgClient.query(
        `SELECT
      *
    FROM
      nft
    WHERE
      "walletId" = $1
      AND "userId" = $2
      AND "chainId" = $3
      AND ("type" = 'ERC721' or "type" = 'Profile' or "type" = 'GenesisKey' or "type" = 'GenesisKeyProfile')`,
        [walletId, userId, chainId],
      )
    ).rows
    do {
      await batchFilterNFTsWithMulticall(nfts.splice(0, 200), walletAddress)
      const end = performance.now()
      logger.info(
        { userId, walletId, walletAddress, chainId, execTimeMillis: end - start },
        `checkNFTContractAddresses processing batch for ${walletAddress}, iteration = ${batchIteration++}`,
      )
    } while (nfts.length)

    const end = performance.now()
    logger.info(
      { userId, walletId, walletAddress, chainId, execTimeMillis: end - start },
      'checkNFTContractAddresses done',
    )
  } catch (err) {
    logger.error(`Error in checkNFTContractAddresses: ${err}`)
    Sentry.captureMessage(`Error in checkNFTContractAddresses: ${err}`)
    return
  }
}

export const refreshNFTMetadata = async (nft: entity.NFT): Promise<entity.NFT> => {
  try {
    // hard refresh for now
    // until Alchemy SDK incorporates this
    const alchemy_api_url = getAlchemyApiUrl(nft.chainId)

    await axios.get(
      `${alchemy_api_url}/getNFTMetadata?contractAddress=${nft.contract}&tokenId=${BigNumber.from(
        nft.tokenId,
      ).toString()}&tokenType=${nft.type == defs.NFTType.ERC1155 ? 'erc1155' : 'erc721'}&refreshCache=true`,
    )

    const metadata = await getNFTMetaData(
      nft.contract,
      BigNumber.from(nft.tokenId).toString(),
      nft.chainId || process.env.CHAIN_ID,
    )
    if (!metadata) {
      logger.debug(`No metadata found for contract ${nft.contract} and tokenId ${nft.tokenId}`)
      return nft
    }
    const { type, name, description, image, traits } = metadata
    const isTraitSame =
      nft.metadata.traits.length == traits.length &&
      nft.metadata.traits.every(function (element, index) {
        return element.type === traits[index].type && element.value === traits[index].value
      })
    // if metadata changed, we update metadata...
    if (
      nft.type !== type ||
      nft.metadata.name !== name ||
      nft.metadata.description !== description ||
      nft.metadata.imageURL !== image ||
      !isTraitSame
    ) {
      return await repositories.nft.updateOneById(nft.id, {
        type,
        metadata: {
          name,
          description,
          imageURL: image,
          traits: traits,
        },
      })
    }
    return nft
  } catch (err) {
    logger.error(`Error in refreshNFTMetadata: ${err}`)
    Sentry.captureMessage(`Error in refreshNFTMetadata: ${err}`)
    throw err
  }
}

export const getOwnersOfGenesisKeys = async (chainId: string): Promise<object> => {
  const contract = contracts.genesisKeyAddress(chainId)
  if (chainId !== '1' && chainId !== '5') return []
  try {
    const key = `${CacheKeys.GENESIS_KEY_OWNERS}_${chainId}`
    const cachedData = await cache.get(key)
    if (cachedData) {
      return JSON.parse(cachedData) as object
    }
    // until Alchemy SDK incorporates this
    const alchemy_api_url = getAlchemyApiUrl(chainId)
    const res = await axios.get(`${alchemy_api_url}/getOwnersForCollection?contractAddress=${contract}`)
    if (res && res?.data && res.data?.ownerAddresses) {
      const gkOwners = res.data.ownerAddresses as string[]
      const gkOwnersObj = gkOwners.reduce((acc, curr) => {
        acc[helper.checkSum(curr)] = true
        return acc
      }, {})
      await cache.set(key, JSON.stringify(gkOwnersObj), 'EX', 60)
      return gkOwnersObj
    } else {
      return Promise.reject(`No owner found for genesis key on chain ${chainId}`)
    }
  } catch (err) {
    logger.error(`Error in getOwnersOfGenesisKeys: ${err}`)
    Sentry.captureMessage(`Error in getOwnersOfGenesisKeys: ${err}`)
    throw err
  }
}

export const executeUpdateNFTsForProfile = async (profileUrl: string, chainId: string): Promise<void> => {
  try {
    const recentlyRefreshed: string = await cache.zscore(`${CacheKeys.UPDATED_NFTS_PROFILE}_${chainId}`, profileUrl)
    if (recentlyRefreshed) {
      // remove profile from cache which store recently refreshed
      await cache.zrem(`${CacheKeys.UPDATED_NFTS_PROFILE}_${chainId}`, [profileUrl])
    }
    const inProgress = await cache.zscore(`${CacheKeys.PROFILES_IN_PROGRESS}_${chainId}`, profileUrl)
    if (inProgress) {
      await cache.zrem(`${CacheKeys.PROFILES_IN_PROGRESS}_${chainId}`, [profileUrl])
    }
    const inQueue = await cache.zscore(`${CacheKeys.UPDATE_NFTS_PROFILE}_${chainId}`, profileUrl)
    if (!inQueue) {
      // add to NFT cache list
      await cache.zadd(`${CacheKeys.UPDATE_NFTS_PROFILE}_${chainId}`, 'INCR', 1, profileUrl)
    }
  } catch (err) {
    logger.error(`Error in executeUpdateNFTsForProfile: ${err}`)
    Sentry.captureMessage(`Error in executeUpdateNFTsForProfile: ${err}`)
    throw err
  }
}

export const getOwnersOfNFTProfile = async (chainId: string): Promise<object> => {
  const contract = contracts.nftProfileAddress(chainId)
  if (chainId !== '1' && chainId !== '5') return []
  try {
    const key = `${CacheKeys.NFT_PROFILE_OWNERS}_${chainId}`
    const cachedData = await cache.get(key)
    if (cachedData) {
      return JSON.parse(cachedData) as object
    }

    const alchemy_api_url = getAlchemyApiUrl(chainId)
    const res = await axios.get(`${alchemy_api_url}/getOwnersForCollection?contractAddress=${contract}`)
    if (res && res?.data && res.data?.ownerAddresses) {
      const profileOwners = res.data.ownerAddresses as string[]
      const profileOwnersObj = profileOwners.reduce((acc, curr) => {
        acc[helper.checkSum(curr)] = true
        return acc
      }, {})
      await cache.set(key, JSON.stringify(profileOwnersObj), 'EX', 60)
      return profileOwners
    } else {
      return Promise.reject(`No owner found for NFT profile on chain ${chainId}`)
    }
  } catch (err) {
    logger.error(`Error in getOwnersOfNFTProfile: ${err}`)
    Sentry.captureMessage(`Error in getOwnersOfNFTProfile: ${err}`)
    throw err
  }
}

export const hideAllNFTs = async (repositories: db.Repository, profileId: string): Promise<void> => {
  try {
    const edges = await repositories.edge.find({
      where: {
        thisEntityType: defs.EntityType.Profile,
        thisEntityId: profileId,
        edgeType: defs.EdgeType.Displays,
        thatEntityType: defs.EntityType.NFT,
        hide: false,
      },
    })
    if (edges.length) {
      const updatedEdges = []
      for (let i = 0; i < edges.length; i++) {
        updatedEdges.push({
          id: edges[i].id,
          hide: true,
        })
      }
      await repositories.edge.saveMany(updatedEdges, { chunk: MAX_SAVE_COUNTS })
    }
  } catch (err) {
    logger.error(`Error in hideAllNFTs: ${err}`)
    Sentry.captureMessage(`Error in hideAllNFTs: ${err}`)
    throw err
  }
}

const saveEdgesForNFTs = async (
  profileId: string,
  hide: boolean,
  nfts: entity.NFT[],
  useWeights = true,
): Promise<void> => {
  try {
    logger.info(`saveEdgesForNFTs: ${profileId} ${hide} ${nfts?.length}`)
    const startTime = new Date().getTime()

    const saved = []
    const duplicated = []
    let weight = null
    // generate weights for nfts...
    if (useWeights) weight = await getLastWeight(repositories, profileId)
    for (let i = 0; i < nfts.length; i++) {
      const foundEdge = await repositories.edge.findOne({
        where: {
          thisEntityType: defs.EntityType.Profile,
          thatEntityType: defs.EntityType.NFT,
          thisEntityId: profileId,
          thatEntityId: nfts[i].id,
          edgeType: defs.EdgeType.Displays,
        },
      })

      if (!foundEdge) {
        let newWeight = null
        if (useWeights) newWeight = generateWeight(weight)

        // save immedietely for save on memory
        await repositories.edge.save({
          thisEntityType: defs.EntityType.Profile,
          thatEntityType: defs.EntityType.NFT,
          thisEntityId: profileId,
          thatEntityId: nfts[i].id,
          edgeType: defs.EdgeType.Displays,
          weight: newWeight,
          hide: hide,
        })

        saved.push({
          thisEntityType: defs.EntityType.Profile,
          thatEntityType: defs.EntityType.NFT,
          thisEntityId: profileId,
          thatEntityId: nfts[i].id,
          edgeType: defs.EdgeType.Displays,
          weight: newWeight,
          hide: hide,
        })
        if (useWeights) weight = newWeight
      } else {
        duplicated.push({
          thisEntityType: defs.EntityType.Profile,
          thatEntityType: defs.EntityType.NFT,
          thisEntityId: profileId,
          thatEntityId: nfts[i].id,
          edgeType: defs.EdgeType.Displays,
        })
      }
    }

    logger.info(
      {
        saved,
        duplicated,
      },
      `saveEdgesForNFTs: ${profileId} edges saved = ${saved.length}`,
    )
    logger.info(
      `saveEdgesForNFTs: ${profileId} ${hide} ${nfts.length}, weight = ${weight} done, time = ${
        new Date().getTime() - startTime
      } ms`,
    )
  } catch (err) {
    await cache.zrem(`${CacheKeys.PROFILES_IN_PROGRESS}_${chainId}`, [profileId])
    logger.error(err, `Error in saveEdgesForNFTs: ${err}`)
    Sentry.captureMessage(`Error in saveEdgesForNFTs: ${err}`)
    throw err
  }
}

export const saveEdgesWithWeight = async (
  profileId: string,
  hide: boolean,
  { nfts, walletId, useWeights = true }: { nfts?: entity.NFT[]; walletId?: string; useWeights?: boolean } = {},
): Promise<void> => {
  try {
    if (nfts) {
      await saveEdgesForNFTs(profileId, hide, nfts, useWeights)
    } else if (walletId) {
      const pgClientPool = db.getPgClient(true)
      const nftsForWallet = (
        await pgClientPool.query(
          `SELECT
        *
      FROM
        nft
      WHERE
        "walletId" = $1
        AND "chainId" = $2`,
          [walletId, chainId],
        )
      ).rows as entity.NFT[]
      await saveEdgesForNFTs(profileId, hide, nftsForWallet, useWeights)
    }
  } catch (err) {
    logger.error(`Error in saveEdgesWithWeight: ${err}`)
    Sentry.captureMessage(`Error in saveEdgesWithWeight: ${err}`)
    throw err
  }
}

export const showAllNFTs = async (
  repositories: db.Repository,
  walletId: string,
  profileId: string,
  chainId: string,
): Promise<void> => {
  try {
    const nftCount = await repositories.nft.count({ walletId, chainId })
    if (nftCount) {
      await saveEdgesWithWeight(profileId, false, { walletId, useWeights: true })
      // change hide column to false which ones are true...
      const edges = await repositories.edge.find({
        where: {
          thisEntityType: defs.EntityType.Profile,
          thatEntityType: defs.EntityType.NFT,
          thisEntityId: profileId,
          edgeType: defs.EdgeType.Displays,
          hide: true,
        },
      })
      if (edges.length) {
        const updatedEdges = []
        for (let i = 0; i < edges.length; i++) {
          updatedEdges.push({
            id: edges[i].id,
            hide: false,
          })
        }
        await repositories.edge.saveMany(updatedEdges, { chunk: MAX_SAVE_COUNTS })
      }
    }
  } catch (err) {
    logger.error(`Error in showAllNFTs: ${err}`)
    Sentry.captureMessage(`Error in showAllNFTs: ${err}`)
    throw err
  }
}

export const showNFTs = async (showNFTIds: string[], profileId: string, chainId: string): Promise<void> => {
  try {
    const nfts = []
    await Promise.allSettled(
      showNFTIds.map(async id => {
        const existingNFT = await repositories.nft.findOne({ where: { id, chainId } })
        if (existingNFT) nfts.push(existingNFT)
      }),
    )
    if (nfts.length) {
      await saveEdgesWithWeight(profileId, false, { nfts, useWeights: true })
      // change hide column to false which ones are true...
      await Promise.allSettled(
        nfts.map(async (nft: entity.NFT) => {
          const displayEdge = await repositories.edge.findOne({
            where: {
              thisEntityType: defs.EntityType.Profile,
              thatEntityType: defs.EntityType.NFT,
              thisEntityId: profileId,
              thatEntityId: nft.id,
              edgeType: defs.EdgeType.Displays,
              hide: true,
            },
          })
          if (displayEdge) await repositories.edge.updateOneById(displayEdge.id, { hide: false })
        }),
      )
    }
  } catch (err) {
    logger.error(`Error in showNFTs: ${err}`)
    Sentry.captureMessage(`Error in showNFTs: ${err}`)
    throw err
  }
}

/**
 * change visibility of profile NFTs
 * hideNFTIds takes priority over showNFTIds (like if the same ID is in both arrays)
 * showAll, hideAll, and -Ids arrays are mutually exclusive (only one of those 3 will be respected, with priority to showAll)
 * @param repositories
 * @param walletId
 * @param profileId
 * @param showAll
 * @param hideAll
 * @param showNFTIds - set the NFTs' visibility as show, without regard to the previous value
 * @param hideNFTIds - set the NFTs' visibility as hide, without regard to the previous value
 * @param chainId
 */
export const changeNFTsVisibility = async (
  repositories: db.Repository,
  walletId: string,
  profileId: string,
  showAll: boolean,
  hideAll: boolean,
  showNFTIds: Array<string> | null,
  hideNFTIds: Array<string> | null,
  chainId: string,
): Promise<void> => {
  try {
    if (showAll) {
      await showAllNFTs(repositories, walletId, profileId, chainId)
      await cache.del([
        `${CacheKeys.PROFILE_SORTED_NFTS}_${chainId}_${profileId}`,
        `${CacheKeys.PROFILE_SORTED_VISIBLE_NFTS}_${chainId}_${profileId}`,
      ])
      return
    } else if (hideAll) {
      await hideAllNFTs(repositories, profileId)
      await cache.del([
        `${CacheKeys.PROFILE_SORTED_NFTS}_${chainId}_${profileId}`,
        `${CacheKeys.PROFILE_SORTED_VISIBLE_NFTS}_${chainId}_${profileId}`,
      ])
      return
    } else {
      let clearCache = false
      if (showNFTIds?.length) {
        await showNFTs(showNFTIds, profileId, chainId)
        clearCache = true
      }
      if (hideNFTIds && hideNFTIds?.length) {
        await Promise.allSettled(
          hideNFTIds?.map(async id => {
            const existingNFT = await repositories.nft.findOne({ where: { id, chainId } })
            if (existingNFT) {
              const edgeVals = {
                thisEntityId: profileId,
                thisEntityType: defs.EntityType.Profile,
                thatEntityId: existingNFT.id,
                thatEntityType: defs.EntityType.NFT,
                edgeType: defs.EdgeType.Displays,
                hide: false,
              }
              const existingEdge = await repositories.edge.findOne({ where: edgeVals })
              if (existingEdge) {
                await repositories.edge.updateOneById(existingEdge.id, { hide: true })
              }
            }
          }),
        )
        clearCache = true
      }
      if (clearCache) {
        await cache.del([
          `${CacheKeys.PROFILE_SORTED_NFTS}_${chainId}_${profileId}`,
          `${CacheKeys.PROFILE_SORTED_VISIBLE_NFTS}_${chainId}_${profileId}`,
        ])
      }
    }
  } catch (err) {
    logger.error(`Error in changeNFTsVisibility: ${err}`)
    Sentry.captureMessage(`Error in changeNFTsVisibility: ${err}`)
    throw err
  }
}

export const createEdgesForProfile = async (profileId: string, walletId: string): Promise<void> => {
  try {
    const nftCount = await repositories.nft.count({
      walletId: walletId,
      chainId: chainId,
    })
    logger.info({ nftCount, profileId, walletId }, 'createEdgesForProfile')
    // save edges for new nfts...
    logger.info(`createEdgesForProfile: saveEdgesWithWeight for profileId: ${profileId} and walletId: ${walletId}`)
    // don't use weights for faster syncs
    await saveEdgesWithWeight(profileId, true, { walletId, useWeights: true })

    logger.info(
      `createEdgesForProfile: saveEdgesWithWeight for profileId: ${profileId} and walletId: ${walletId} done!`,
    )
  } catch (err) {
    logger.error(`Error in createEdgesForProfile: ${err}`)
    Sentry.captureMessage(`Error in createEdgesForProfile: ${err}`)
    throw err
  }
}

export const updateNFTsOrder = async (profileId: string, orders: Array<NFTOrder>): Promise<void> => {
  try {
    logger.info(`updateNFTsOrder: orders: ${JSON.stringify(orders)}`)

    const profile = await repositories.profile.findOne({
      where: {
        id: profileId,
      },
    })

    if (profile) {
      await createEdgesForProfile(profileId, profile.ownerWalletId)
      logger.info('updateNFTsOrder: createEdgesForProfile done!')
    }

    for (let i = 0; i < orders?.length; i++) {
      const edges = await repositories.edge.find({
        where: {
          thisEntityType: defs.EntityType.Profile,
          thatEntityType: defs.EntityType.NFT,
          thisEntityId: profileId,
          edgeType: defs.EdgeType.Displays,
          hide: false,
        },
        order: {
          weight: 'ASC',
          updatedAt: 'DESC',
        },
      })

      logger.info(`updateNFTsOrder: edges: ${JSON.stringify(edges)}, ${edges}`)
      const existingNFT = await repositories.nft.findOne({
        where: {
          id: orders[i].nftId,
        },
      })
      if (existingNFT) {
        const existingEdge = await repositories.edge.findOne({
          where: {
            thisEntityType: defs.EntityType.Profile,
            thatEntityType: defs.EntityType.NFT,
            thisEntityId: profileId,
            thatEntityId: orders[i].nftId,
            edgeType: defs.EdgeType.Displays,
            hide: false,
          },
        })
        if (existingEdge) {
          const index = edges.findIndex(edge => edge.id === existingEdge.id)
          if (orders[i].newIndex <= 0) {
            // if new index is first place of nft order...
            if (index !== 0) {
              const edgeWeight = edges[1].weight || generateWeight(await getLastWeight(repositories, profileId))
              await repositories.edge.updateOneById(edges[0].id, {
                weight: midWeight('aaaa', edgeWeight),
              })
              await repositories.edge.updateOneById(existingEdge.id, {
                weight: 'aaaa',
              })
            }
          } else if (orders[i].newIndex >= edges.length - 1) {
            // if new index is last place of nft order...
            if (index !== edges.length - 1) {
              const edgeWeight = edges[edges.length - 1].weight || (await getLastWeight(repositories, profileId))
              await repositories.edge.updateOneById(existingEdge.id, {
                weight: generateWeight(edgeWeight),
              })
            }
          } else {
            // if new index is inside nft order...
            if (index !== orders[i].newIndex) {
              const edgeWeightFirst =
                edges[orders[i].newIndex - 1].weight || generateWeight(await getLastWeight(repositories, profileId))
              const edgeWeightSecond =
                edges[orders[i].newIndex].weight || generateWeight(await getLastWeight(repositories, profileId))
              await repositories.edge.updateOneById(existingEdge.id, {
                weight: midWeight(edgeWeightFirst, edgeWeightSecond),
              })
            }
          }
        }
      }
    }
    if (orders?.length) {
      const chainId = process.env.CHAIN_ID
      await cache.del([
        `${CacheKeys.PROFILE_SORTED_NFTS}_${chainId}_${profileId}`,
        `${CacheKeys.PROFILE_SORTED_VISIBLE_NFTS}_${chainId}_${profileId}`,
      ])
    }
  } catch (err) {
    logger.error(err, `Error in updateNFTsOrder: ${err}`)
    Sentry.captureMessage(`Error in updateNFTsOrder: ${err}`)
    throw err
  }
}

/**
 * Deletes extra edges that do not satisfy the criteria for valid edges.
 * Criteria for deletion include:
 * - NFT does not exist.
 * - NFT exists, but the owner of the NFT is different or not associated with the profile.
 * - Duplicate edges connecting to the same NFT.
 *
 * @param edges - An array of edges to be processed for potential deletion.
 */
const deleteExtraEdges = async (edges: entity.Edge[]): Promise<void> => {
  logger.debug({ edges }, `${edges.length} edges to be synced in syncEdgesWithNFTs`)

  const uniqueProfileIds = [...new Set(edges.map(e => e.thisEntityId))]
  logger.debug(`[deleteExtraEdges] uniqueProfileIds: ${JSON.stringify(uniqueProfileIds)}`)

  const allProfileWalletAndUserIds = await repositories.profile
    .find({ where: { id: In(uniqueProfileIds) } })
    .then(profiles =>
      profiles.map(p => ({
        profileId: p.id,
        walletId: p.ownerWalletId,
        userId: p.ownerUserId,
        associatedAddresses: p.associatedAddresses,
      })),
    )

  logger.debug(`[deleteExtraEdges] allProfileWalletAndUserIds: ${JSON.stringify(allProfileWalletAndUserIds)}`)

  // Create a lookup map for profiles
  const profileLookup = allProfileWalletAndUserIds.reduce<Record<string, (typeof allProfileWalletAndUserIds)[number]>>(
    (acc, p) => {
      acc[p.profileId] = p
      return acc
    },
    {},
  )
  logger.debug(`[deleteExtraEdges] profileLookup: ${JSON.stringify(profileLookup)}`)

  const disconnectedEdgeIds: string[] = []

  // Load NFTs for processing
  const nfts = await nftLoader.loadMany(edges.map(e => e.thatEntityId))

  nfts.forEach((nft: entity.NFT, i) => {
    // Delete edges where NFT does not exist
    if (!nft) {
      disconnectedEdgeIds.push(edges[i].id)
      return
    }

    // Delete edges where owner of NFT is different or not associated
    const profileId = edges[i].thisEntityId
    const foundProfile = profileLookup[profileId]

    if (
      nft.userId &&
      nft.walletId &&
      (foundProfile.userId !== nft.userId || foundProfile.walletId !== nft.walletId) &&
      !foundProfile.associatedAddresses.includes(nft.owner)
    ) {
      disconnectedEdgeIds.push(edges[i].id)
    }
  })

  // Delete edges that are duplicate connections on an NFT
  const edgeIdsToDelete = [...new Set([...disconnectedEdgeIds])]
  logger.debug(
    `[deleteExtraEdges] Deleting ${edgeIdsToDelete.length} edges, edgeIdsToDelete: ${JSON.stringify(edgeIdsToDelete)}`,
  )
  if (edgeIdsToDelete.length) await repositories.edge.hardDeleteByIds(edgeIdsToDelete)
}

export const clearDataloaderCache = async (nftIds: string[]): Promise<void> => {
  try {
    await clearNftCache(nftIds)
  } catch (err) {
    logger.error(err, `Error in clearDataloaderCache: ${err}`)
    Sentry.captureMessage(`Error in clearDataloaderCache: ${err}`)
    throw err
  }
}

export const syncEdgesWithNFTs = async (profileId: string): Promise<void> => {
  try {
    const pgClient = db.getPgClient(true)
    const edges: entity.Edge[] = (
      await pgClient.query(
        `SELECT
        *
      FROM
        edge
      WHERE
        "thisEntityId" = $1
        AND "thisEntityType" = '${defs.EntityType.Profile}'
        AND "thatEntityType" = '${defs.EntityType.NFT}'
        AND "edgeType" = '${defs.EdgeType.Displays}'`,
        [profileId],
      )
    ).rows
    do {
      await deleteExtraEdges(edges.splice(0, 100))
    } while (edges.length)
  } catch (err) {
    logger.error(err, `Error in syncEdgesWithNFTs: ${err}`)
    Sentry.captureMessage(`Error in syncEdgesWithNFTs: ${err}`)
    throw err
  }
}

export const updateNFTsForAssociatedWallet = async (profileUrl: string, wallet: entity.Wallet): Promise<void> => {
  try {
    if (wallet.userId) {
      let start = new Date().getTime()
      const profileExists = await repositories.profile.findOne({ where: { ownerUserId: wallet.userId } })

      // async update in streams bullMQ
      if (profileExists) {
        const recentlyRefreshed: string = await cache.zscore(`${CacheKeys.UPDATED_NFTS_PROFILE}_${chainId}`, profileUrl)
        if (!recentlyRefreshed) {
          // add to NFT cache list
          await cache.zadd(`${CacheKeys.UPDATE_NFTS_PROFILE}_${chainId}`, 'INCR', 1, profileUrl)
        }
        logger.info(
          `updateNFTsForAssociatedWallet: queuing profile ${profileUrl} for update, took ${
            new Date().getTime() - start
          }ms`,
        )
      } else {
        const recentlyRefreshed: string = await cache.zscore(
          `${CacheKeys.UPDATED_NFTS_NON_PROFILE}_${chainId}`,
          wallet.id,
        )
        if (!recentlyRefreshed) {
          // add to NFT cache list
          await cache.zadd(`${CacheKeys.UPDATE_NFTS_NON_PROFILE}_${chainId}`, 'INCR', 1, wallet.id)
        }
        logger.info(
          `updateNFTsForAssociatedWallet: queuing non profile address ${wallet.address} for update, took ${
            new Date().getTime() - start
          }ms`,
        )
      }
      start = new Date().getTime()

      // multicall
      await checkNFTContractAddresses(wallet.userId, wallet.id, wallet.address, wallet.chainId)

      await updateWalletNFTs(wallet.userId, wallet, wallet.chainId)

      logger.info(
        `updateNFTsForAssociatedWallet: checkNFTContractAddresses for wallet ${wallet.id} took ${
          new Date().getTime() - start
        }ms`,
      )
      start = new Date().getTime()

      const profile = await repositories.profile.findOne({ where: { url: profileUrl } })

      if (profile) {
        // save NFT edges for profile...
        await createEdgesForProfile(profile.id, wallet.id)

        logger.info(
          `updateNFTsForAssociatedWallet: createEdgesForProfile for wallet ${wallet.id} took ${
            new Date().getTime() - start
          }ms`,
        )
      } else {
        logger.error(`updateNFTsForAssociatedWallet: profile ${profileUrl} not found!`)
      }
    } else {
      logger.error(`updateNFTsForAssociatedWallet: wallet ${wallet.id} has no userId!`)
    }
  } catch (err) {
    logger.error(`Error in updateNFTsForAssociatedWallet: ${err}`)
    Sentry.captureMessage(`Error in updateNFTsForAssociatedWallet: ${err}`)
    throw err
  }
}

export const removeEdgesForNonassociatedAddresses = async (
  profileId: string,
  prevAddresses: string[],
  newAddresses: string[],
  chainId: string,
): Promise<void> => {
  try {
    const toRemove: string[] = []
    // find previous associated addresses to be filtered
    const seen = {}
    newAddresses.map(address => {
      seen[address] = true
    })
    prevAddresses.map(address => {
      if (!seen[address]) toRemove.push(address)
    })
    if (!toRemove.length) return
    await Promise.allSettled(
      toRemove.map(async address => {
        const wallet = await repositories.wallet.findByChainAddress(chainId, helper.checkSum(address))
        if (wallet) {
          const nfts = await repositories.nft.find({ where: { walletId: wallet.id } })
          if (nfts.length) {
            const toRemoveEdges = []
            await Promise.allSettled(
              nfts.map(async nft => {
                const edge = await repositories.edge.findOne({
                  where: {
                    thisEntityType: defs.EntityType.Profile,
                    thisEntityId: profileId,
                    thatEntityType: defs.EntityType.NFT,
                    thatEntityId: nft.id,
                    edgeType: defs.EdgeType.Displays,
                  },
                })
                if (edge) {
                  toRemoveEdges.push(edge.id)
                  await repositories.nft.updateOneById(nft.id, { profileId: null })
                }
              }),
            )
            if (toRemoveEdges.length) await repositories.edge.hardDeleteByIds(toRemoveEdges)
          }
        }
      }),
    )
  } catch (err) {
    logger.error(`Error in removeEdgesForNonassociatedAddresses: ${err}`)
    Sentry.captureMessage(`Error in removeEdgesForNonassociatedAddresses: ${err}`)
    throw err
  }
}

export const updateNFTsForAssociatedAddresses = async (
  repositories: db.Repository,
  profile: entity.Profile,
  chainId: string,
): Promise<string> => {
  try {
    let start = new Date().getTime()
    logger.info(
      `[nftService.updateNFTsForAssociatedAddresses] Updating NFTs for associated addresses for profile ${profile.url}...`,
    )

    const cacheKey = `${CacheKeys.ASSOCIATED_ADDRESSES}_${chainId}_${profile.url}`
    const cachedData = await cache.get(cacheKey)
    let addresses: string[]
    if (cachedData) {
      addresses = JSON.parse(cachedData)
      logger.debug(
        `${addresses.length} associated addresses for profile ${profile.url} from cache, took ${
          new Date().getTime() - start
        }ms`,
      )
    } else {
      const nftResolverContract = typechain.NftResolver__factory.connect(
        contracts.nftResolverAddress(chainId),
        provider.provider(Number(chainId)),
      )
      const associatedAddresses = await nftResolverContract.associatedAddresses(profile.url)
      addresses = associatedAddresses.map(item => item.chainAddr)
      logger.info(
        `[nftService.updateNFTsForAssociatedAddresses] Got associated addresses for profile ${
          profile.url
        } [${JSON.stringify(addresses)}] in ${new Date().getTime() - start}ms`,
      )
      start = new Date().getTime()

      // remove NFT edges for non-associated addresses
      await removeEdgesForNonassociatedAddresses(profile.id, profile.associatedAddresses, addresses, chainId)

      logger.info(
        `[nftService.updateNFTsForAssociatedAddresses] Removed NFT edges for non-associated addresses for profile ${
          profile.url
        } in ${new Date().getTime() - start}ms`,
      )
      start = new Date().getTime()

      if (!addresses.length) {
        return `No associated addresses of ${profile.url}`
      }

      await cache.set(cacheKey, JSON.stringify(addresses), 'EX', 60 * 5)

      // update associated addresses with the latest updates
      await repositories.profile.updateOneById(profile.id, { associatedAddresses: addresses })
      logger.info(
        `[nftService.updateNFTsForAssociatedAddresses] Updated associated addresses for profile ${profile.url} in ${
          new Date().getTime() - start
        }ms`,
      )
      start = new Date().getTime()
    }

    // save User, Wallet for associated addresses...
    const wallets: entity.Wallet[] = []
    await Promise.allSettled(
      addresses.map(async address => {
        wallets.push(await optionallySaveUserAndWalletForAssociatedAddress(chainId, address, repositories))
      }),
    )
    logger.info(
      `[nftService.updateNFTsForAssociatedAddresses] Saved users for associated addresses for profile ${
        profile.url
      } in ${new Date().getTime() - start}ms`,
    )
    start = new Date().getTime()

    // refresh NFTs for associated addresses...
    await Promise.allSettled(
      wallets.map(async wallet => {
        try {
          await updateNFTsForAssociatedWallet(profile.url, wallet)
        } catch (err) {
          logger.error(`Error in updateNFTsForAssociatedAddresses: ${err}`)
          Sentry.captureMessage(`Error in updateNFTsForAssociatedAddresses: ${err}`)
        }
      }),
    )
    logger.info(
      `[nftService.updateNFTsForAssociatedAddresses] Updated NFTs for associated addresses for profile ${
        profile.url
      } in ${new Date().getTime() - start}ms`,
    )
    start = new Date().getTime()

    await syncEdgesWithNFTs(profile.id)
    logger.info(
      `[nftService.updateNFTsForAssociatedAddresses] Synced edges with NFTs for profile ${profile.url} in ${
        new Date().getTime() - start
      }ms`,
    )
    start = new Date().getTime()

    return `refreshed NFTs for associated addresses of ${profile.url}`
  } catch (err) {
    Sentry.captureMessage(`Error in updateNFTsForAssociatedAddresses: ${err}`)
    return `error while refreshing NFTs for associated addresses of ${profile.url}`
  }
}

export const updateCollectionForAssociatedContract = async (
  repositories: db.Repository,
  profile: entity.Profile,
  chainId: string,
  walletAddress: string,
): Promise<string> => {
  try {
    const cacheKey = `${CacheKeys.ASSOCIATED_CONTRACT}_${chainId}_${profile.url}`
    const cachedData = await cache.get(cacheKey)
    let contract
    if (cachedData) {
      contract = JSON.parse(cachedData)
    } else {
      const nftResolverContract = typechain.NftResolver__factory.connect(
        contracts.nftResolverAddress(chainId),
        provider.provider(Number(chainId)),
      )
      const associatedContract = await nftResolverContract.associatedContract(profile.url)
      if (!associatedContract) {
        return `No associated contract of ${profile.url}`
      }
      if (!associatedContract.chainAddr) {
        return `No associated contract of ${profile.url}`
      }
      contract = helper.checkSum(associatedContract.chainAddr)
      await cache.set(cacheKey, JSON.stringify(contract), 'EX', 60 * 5)
      // update associated contract with the latest updates
      await repositories.profile.updateOneById(profile.id, { associatedContract: contract })
    }
    // get collection info
    let collectionName = await getCollectionNameFromDataProvider(contract, chainId, defs.NFTType.ERC721)
    if (collectionName === 'Unknown Name') {
      collectionName = await getCollectionNameFromDataProvider(contract, chainId, defs.NFTType.ERC1155)
    }
    // check if deployer of associated contract is in associated addresses
    const deployer = await getCollectionDeployer(contract, chainId)
    if (!deployer) {
      if (profile.profileView === defs.ProfileViewType.Collection) {
        await repositories.profile.updateOneById(profile.id, {
          profileView: defs.ProfileViewType.Gallery,
        })
      }
      return `Updated associated contract for ${profile.url}`
    } else {
      const collection = await repositories.collection.findByContractAddress(contract, chainId)
      if (!collection) {
        const savedCollection = await repositories.collection.save({
          contract,
          name: collectionName,
          chainId,
          deployer,
        })
        await seService.indexCollections([savedCollection])
      }
      const checkedDeployer = helper.checkSum(deployer)
      const isAssociated =
        profile.associatedAddresses.indexOf(checkedDeployer) !== -1 || checkedDeployer === walletAddress
      if (!isAssociated && profile.profileView === defs.ProfileViewType.Collection) {
        await repositories.profile.updateOneById(profile.id, {
          profileView: defs.ProfileViewType.Gallery,
        })
      }
      return `Updated associated contract for ${profile.url}`
    }
  } catch (err) {
    Sentry.captureMessage(`Error in updateCollectionForAssociatedContract: ${err}`)
    return `error while updating associated contract of ${profile.url}`
  }
}

export const updateGKIconVisibleStatus = async (
  repositories: db.Repository,
  chainId: string,
  profile: entity.Profile,
): Promise<void> => {
  try {
    const gkOwners = await getOwnersOfGenesisKeys(chainId)
    const wallet = await repositories.wallet.findById(profile.ownerWalletId)
    const exists = gkOwners[helper.checkSum(wallet.address)]
    if (exists) {
      await repositories.profile.updateOneById(profile.id, { gkIconVisible: false })
    } else {
      return
    }
  } catch (err) {
    logger.error(`Error in updateGKIconVisibleStatus: ${err}`)
    Sentry.captureMessage(`Error in updateGKIconVisibleStatus: ${err}`)
    throw err
  }
}

export const profileNFTCount = async (
  profileIds: string[],
  repositories: db.Repository,
  chainId: string,
): Promise<gql.ProfileVisibleNFTCount[]> => {
  try {
    if (profileIds.length) {
      return repositories.profile.find({
        where: {
          id: In([...profileIds]),
          chainId,
        },
        select: {
          id: true,
          visibleNFTs: true,
        },
      })
    }
  } catch (err) {
    logger.error(err, 'Error in profileNFTCount')
  }
  return []
}

export const saveVisibleNFTsForProfile = async (profileId: string, repositories: db.Repository): Promise<void> => {
  try {
    logger.info(`starting saveVisibleNFTsForProfile: ${profileId}`)
    const start = new Date().getTime()
    const edges = await repositories.edge.count({
      thisEntityId: profileId,
      thisEntityType: defs.EntityType.Profile,
      thatEntityType: defs.EntityType.NFT,
      edgeType: defs.EdgeType.Displays,
      hide: false,
    })
    if (edges) {
      await repositories.profile.updateOneById(profileId, { visibleNFTs: edges })
      logger.info(
        `saveVisibleNFTsForProfile: ${profileId} - ${edges} visible NFTs, time taken: ${
          new Date().getTime() - start
        }ms`,
      )
    } else {
      logger.info(
        `saveVisibleNFTsForProfile: ${profileId} - no visible NFTs, time taken: ${new Date().getTime() - start}ms`,
      )
    }
  } catch (err) {
    logger.error(`Error in saveVisibleNFTsForProfile: ${err}`)
    Sentry.captureMessage(`Error in saveVisibleNFTsForProfile: ${err}`)
    throw err
  }
}

export const saveProfileScore = async (repositories: db.Repository, profile: entity.Profile): Promise<void> => {
  try {
    if (profile.ownerUserId && profile.chainId) {
      let start = new Date().getTime()
      const gkContractAddress = contracts.genesisKeyAddress(profile.chainId)

      // get genesis key numbers
      const gkNFTs = await repositories.nft.find({
        where: { userId: profile.ownerUserId, contract: gkContractAddress, chainId: profile.chainId },
      })

      logger.info(`saveProfileScore: Time taken to get gkNFTs: ${new Date().getTime() - start} ms`)
      start = new Date().getTime()

      // get collections
      const nfts = await repositories.nft.find({
        where: { userId: profile.ownerUserId, chainId: profile.chainId },
      })

      logger.info(`saveProfileScore: Time taken to get nfts: ${new Date().getTime() - start} ms`)
      start = new Date().getTime()

      // get unique nft.contract from nfts with
      const collections = [...new Set(nfts.map(nft => nft.contract))]

      // get visible items
      const visibleEdgesCount = await repositories.edge.count({
        thisEntityId: profile.id,
        thisEntityType: defs.EntityType.Profile,
        thatEntityType: defs.EntityType.NFT,
        edgeType: defs.EdgeType.Displays,
        hide: false,
      })

      logger.info(`saveProfileScore: Time taken to get visibleEdgesCount: ${new Date().getTime() - start} ms`)
      start = new Date().getTime()

      const paddedGK = gkNFTs.length.toString().padStart(5, '0')
      const paddedCollections = collections.length.toString().padStart(5, '0')
      const score = visibleEdgesCount.toString().concat(paddedCollections).concat(paddedGK)
      await cache.zadd(`LEADERBOARD_${profile.chainId}`, score, profile.id)
    } else {
      logger.info(`saveProfileScore: No ownerUserId or chainId for profile ${profile.id}`)
    }
  } catch (err) {
    logger.error(`Error in saveProfileScore: ${err}`)
    Sentry.captureMessage(`Error in saveProfileScore: ${err}`)
    throw err
  }
}

export const getCollectionInfo = async (args: GetCollectionInfoArgs): Promise<any> => {
  try {
    // Set variables
    const { chainId, repositories } = args
    let slug
    let collection
    let contract
    let description = null
    let nftPortResults = undefined
    let bannerUrl = 'https://cdn.nft.com/collectionBanner_default.png'
    let logoUrl = 'https://cdn.nft.com/profile-image-default.svg'
    const uploadPath = `collections/${chainId}/`

    if ('contract' in args) {
      contract = args.contract
    }

    if ('slug' in args) {
      slug = args.slug
    }

    const key = `${contract ? contract.toLowerCase() : slug.toLowerCase()}-${chainId}`
    const cachedData = await cache.get(key)

    if (cachedData) {
      return JSON.parse(cachedData)
    }

    collection = contract
      ? await repositories.collection.findByContractAddress(helper.checkSum(contract), chainId)
      : await repositories.collection.findOne({
          where: {
            chainId,
            deletedAt: null,
            isOfficial: true,
            slug: ILike(`%${slug}%`),
          },
        })

    if (!collection) {
      if (slug) {
        // throw err if name lookup fails
        throw appError.buildNotFound(
          collectionError.buildOfficialCollectionNotFoundMsg(`with the following slug "${slug}" on chain ${chainId}`),
          collectionError.ErrorType.CollectionNotFound,
        )
      }
      return {
        collection,
        nftPortResults,
      }
    }

    // Set contract if collection is found by name
    if (collection && collection.contract && !contract) {
      contract = collection.contract
    }

    if (collection && (collection.deployer == null || helper.checkSum(collection.deployer) !== collection.deployer)) {
      const collectionDeployer = await getCollectionDeployer(contract, chainId)
      collection = await repositories.collection.save({
        ...collection,
        deployer: collectionDeployer,
      })
    }

    const nft = await repositories.nft.findOne({
      where: {
        contract: helper.checkSum(contract),
        chainId,
      },
    })

    if (!nft) {
      return {
        collection,
        nftPortResults,
      }
    }

    // check if logoUrl, bannerUrl, description are null or default -> if not, return, else, proceed
    const notAllowedToProceed: boolean =
      !!collection.bannerUrl &&
      !exceptionBannerUrlRegex.test(collection.bannerUrl) &&
      !!collection.logoUrl &&
      collection.logoUrl !== logoUrl &&
      !!collection.description

    if (notAllowedToProceed) {
      return {
        collection,
        nftPortResults,
      }
    }

    const details = await retrieveNFTDetailsNFTPort(nft.contract, nft.tokenId, nft.chainId)
    if (details) {
      if (details.contract) {
        if (details.contract.metadata?.cached_banner_url && details.contract.metadata?.cached_banner_url?.length) {
          const filename = details.contract.metadata.cached_banner_url.split('/').pop()
          const banner = await uploadImageToS3(
            details.contract.metadata.cached_banner_url,
            filename,
            chainId,
            contract,
            uploadPath,
          )

          if (banner) {
            bannerUrl = banner
          } else {
            if (nft.metadata?.imageURL) {
              bannerUrl = nft.metadata.imageURL
            }
          }
        }
        if (
          details.contract.metadata?.cached_thumbnail_url &&
          details.contract.metadata?.cached_thumbnail_url?.length
        ) {
          const filename = details.contract.metadata.cached_thumbnail_url.split('/').pop()
          const logo = await uploadImageToS3(
            details.contract.metadata.cached_thumbnail_url,
            filename,
            chainId,
            contract,
            uploadPath,
          )
          logoUrl = logo ? logo : logoUrl
        }
        if (details.contract.metadata?.description) {
          description = details.contract.metadata?.description?.length
            ? details.contract.metadata.description
            : description
        }
      }
      const updatedCollection = await repositories.collection.updateOneById(collection.id, {
        bannerUrl,
        logoUrl,
        description,
      })
      await seService.indexCollections([updatedCollection])
      collection = await repositories.collection.findByContractAddress(helper.checkSum(contract), chainId)
      nftPortResults = {
        name: details.contract?.name,
        symbol: details.contract?.symbol,
        bannerUrl: details.contract?.metadata?.cached_banner_url,
        logoUrl: details.contract?.metadata?.cached_thumbnail_url,
        description: details.contract?.metadata?.description,
      }
    } else {
      if (!collection.bannerUrl || !collection.logoUrl || !collection.description) {
        if (nft.metadata?.imageURL) {
          bannerUrl = nft.metadata.imageURL
        }
        await seService.indexCollections([
          await repositories.collection.updateOneById(collection.id, {
            bannerUrl,
            logoUrl,
            description,
          }),
        ])
        collection = await repositories.collection.findByContractAddress(helper.checkSum(contract), chainId)
      }
    }

    const returnObject = {
      collection,
      nftPortResults,
    }

    await cache.set(key, JSON.stringify(returnObject), 'EX', 60 * 5)
    return returnObject
  } catch (err) {
    logger.error(`Error in getCollectionInfo: ${err}`)
    Sentry.captureMessage(`Error in getCollectionInfo: ${err}`)
    throw err
  }
}

export const updateNFTMetadata = async (nft: entity.NFT, repositories: db.Repository): Promise<void> => {
  try {
    initiateWeb3(nft.chainId)
    const metadata = await getNFTMetaData(nft.contract, nft.tokenId, nft.chainId || process.env.CHAIN_ID)
    if (!metadata) return
    const { type, name, description, image, traits } = metadata
    await repositories.nft.updateOneById(nft.id, {
      type,
      metadata: {
        name,
        description,
        imageURL: image,
        traits: traits,
      },
    })
  } catch (err) {
    logger.error(`Error in updateNFTMedata: ${err}`)
    Sentry.captureMessage(`Error in updateNFTMedata: ${err}`)
  }
}

export const getUserWalletFromNFT = async (
  contract: string,
  tokenId: string,
  chainId: string,
): Promise<entity.Wallet | undefined> => {
  try {
    const nft = {
      contract,
      tokenId,
      chainId,
    }
    const owners = await getOwnersForNFT(nft)
    if (!owners.length) {
      return undefined
    } else {
      if (owners.length > 1) {
        // We don't save multiple owners for now, so we don't keep this NFT too
        return undefined
      } else {
        const csOwner = helper.checkSum(owners[0])
        const fallbackWallet = new entity.Wallet()
        fallbackWallet.address = csOwner
        return (await repositories.wallet.findByChainAddress(chainId, csOwner)) || fallbackWallet
      }
    }
  } catch (err) {
    logger.debug(`Error in getUserWalletFromNFT: ${err}`)
    Sentry.captureMessage(`Error in getUserWalletFromNFT: ${err}`)
    return undefined
  }
}

export const saveNewNFT = async (
  contract: string,
  tokenId: string,
  chainId: string,
): Promise<entity.NFT | undefined> => {
  try {
    const wallet = await getUserWalletFromNFT(contract, tokenId, chainId)
    if (!wallet) {
      return undefined
    }
    const metadata = await getNFTMetaData(contract, tokenId, chainId)
    if (!metadata) return undefined

    const { type, name, description, image, traits } = metadata
    const csOwner = helper.checkSum(wallet.address)
    const savedNFT = await repositories.nft.save({
      chainId: chainId,
      userId: wallet.userId,
      walletId: wallet.id,
      owner: csOwner,
      contract: helper.checkSum(contract),
      tokenId: BigNumber.from(tokenId).toHexString(),
      type,
      metadata: {
        name,
        description,
        imageURL: image,
        traits: traits,
      },
    })

    await seService.indexNFTs([savedNFT])
    await updateCollectionForNFTs([savedNFT])
    return savedNFT
  } catch (err) {
    logger.error(`Error in saveNewNFT: ${err}`)
    Sentry.captureMessage(`Error in saveNewNFT: ${err}`)
    throw err
  }
}

export const filterNativeOrdersForNFT = async (
  orders: entity.TxOrder[],
  contract: string,
  tokenId: string,
  status: defs.ActivityStatus = defs.ActivityStatus.Valid,
): Promise<entity.TxOrder[]> => {
  const filteredOrders: entity.TxOrder[] = []
  await Promise.allSettled(
    orders.map(async (order: entity.TxOrder) => {
      const matchingMakeAsset = order.protocolData.makeAsset.find(asset => {
        return (
          asset?.standard?.contractAddress &&
          helper.checkSum(asset?.standard?.contractAddress) === helper.checkSum(contract) &&
          BigNumber.from(asset?.standard?.tokenId).eq(BigNumber.from(tokenId))
        )
      })
      if (matchingMakeAsset) {
        const activity = await repositories.txActivity.findOne({ where: { activityTypeId: order.orderHash } })
        if (activity.status === status) {
          filteredOrders.push(order)
        }
      }
    }),
  )
  return filteredOrders
}

/**
 * getNFTActivities
 * @param activityType
 */
export const getNFTActivities = <T>(activityType: defs.ActivityType) => {
  return async (parent: T, args: unknown, ctx: Context): Promise<Pageable<entity.TxActivity> | null> => {
    try {
      let pageInput: gql.PageInput = args?.['listingsPageInput']
      const expirationType: gql.ActivityExpiration = args?.['listingsExpirationType']
      const listingsStatus: defs.ActivityStatus = args?.['listingsStatus'] || defs.ActivityStatus.Valid
      let listingsOwnerAddress: string = args?.['listingsOwner']
      if (!listingsOwnerAddress) {
        const walletId = parent?.['walletId']

        if (walletId && walletId !== TEST_WALLET_ID) {
          const wallet: entity.Wallet = await ctx.repositories.wallet.findById(walletId)
          listingsOwnerAddress = wallet?.address
        }
      }

      if (!pageInput) {
        pageInput = {
          first: 50,
        }
      }
      const contract = parent?.['contract']
      const tokenId = parent?.['tokenId']
      const chainId = parent?.['chainId'] || process.env.chainId

      const protocol: gql.ProtocolType = args?.['protocol']

      if (contract && tokenId) {
        const checksumContract = helper.checkSum(contract)
        const nftId = `ethereum/${checksumContract}/${BigNumber.from(tokenId).toHexString()}`
        let filters: defs.ActivityFilters = {
          nftContract: checksumContract,
          nftId,
          activityType,
          status: listingsStatus,
          chainId,
        }

        if (listingsOwnerAddress) {
          filters = { ...filters, walletAddress: helper.checkSum(listingsOwnerAddress) }
        }
        // by default active items are included
        if (!expirationType || expirationType === gql.ActivityExpiration.Active) {
          filters = { ...filters, expiration: helper.moreThanDate(new Date().toString()) }
        } else if (expirationType === gql.ActivityExpiration.Expired) {
          filters = { ...filters, expiration: helper.lessThanDate(new Date().toString()) }
        }
        const safefilters = [helper.inputT2SafeK(filters)]
        return paginatedActivitiesBy(
          ctx.repositories.txActivity,
          pageInput,
          safefilters,
          [],
          'createdAt',
          'DESC',
          protocol,
        ).then(pagination.toPageable(pageInput, null, null, 'createdAt'))
      }
    } catch (err) {
      logger.error(`Error in getNFTActivities: ${err}`)
      Sentry.captureMessage(`Error in getNFTActivities: ${err}`)
      throw err
    }
  }
}

export const queryNFTsForProfile = async (
  repositories: db.Repository,
  profile: entity.Profile,
  onlyVisible: boolean,
  query: string,
): Promise<entity.NFT[]> => {
  const whereQuery = {
    thisEntityType: defs.EntityType.Profile,
    thisEntityId: profile.id,
    thatEntityType: defs.EntityType.NFT,
    edgeType: defs.EdgeType.Displays,
  }

  const edges = onlyVisible
    ? await repositories.edge.find({
        where: { ...whereQuery, hide: false },
      })
    : await repositories.edge.find({ where: whereQuery })
  const nfts: entity.NFT[] = []
  await Promise.allSettled(
    edges.map(async edge => {
      const nft = await repositories.nft.findById(edge.thatEntityId)
      if (nft && nft.metadata.name && nft.metadata.name.toLowerCase().includes(query.toLowerCase())) {
        nfts.push(nft)
      }
    }),
  )
  return nfts
}

// no cache to have instant updates
export const profileOwner = async (profileUrl: string, chainId: string): Promise<string | undefined> => {
  try {
    const nftProfileContract = typechain.NftProfile__factory.connect(
      contracts.nftProfileAddress(chainId),
      provider.provider(Number(chainId)),
    )
    const owner = await nftProfileContract.profileOwner(profileUrl)
    return owner
  } catch (err) {
    logger.error(`Error in profileOwner: ${err}`)
    Sentry.captureMessage(`Error in profileOwner: ${err}`)
    return undefined
  }
}

const checksumContract = (contract: string): string | undefined => {
  try {
    return helper.checkSum(contract)
  } catch (err) {
    logger.error(err, `Unable to checkSum contract: ${contract}`)
  }
  return
}

export const profileGKNFT = async (contract: string, tokenId: string, chainId: string): Promise<boolean> => {
  const checksumedContract: string = checksumContract(contract)
  const profileContract: string = contracts.nftProfileAddress(chainId)

  if (checksumedContract != profileContract) {
    return false
  }

  let numericTokenId = ''

  try {
    numericTokenId = helper.bigNumberToNumber(tokenId).toString()
  } catch (err) {
    logger.error(err, `Error while converting profile tokenId: ${numericTokenId}`)
  }

  const cachedProfileGkValue: string = await cache.zscore(`${CacheKeys.PROFILE_GK_NFT}_${chainId}`, numericTokenId)

  if (cachedProfileGkValue) {
    if (Number(cachedProfileGkValue) === 1) {
      return true
    } else {
      return false
    }
  }

  let profile = await repositories.profile.findOne({
    where: {
      tokenId: numericTokenId,
    },
  })

  if (!profile.expireAt) {
    const nftProfileContract = typechain.NftProfile__factory.connect(
      contracts.nftProfileAddress(chainId),
      provider.provider(Number(chainId)),
    )
    try {
      const expiry = await nftProfileContract.getExpiryTimeline([profile.url])
      const timestamp = helper.bigNumberToNumber(expiry?.[0])
      if (Number(timestamp) !== 0) {
        const expireAt = new Date(Number(timestamp) * 1000)
        profile = await repositories.profile.updateOneById(profile.id, { expireAt })
      }
    } catch (err) {
      logger.error(err, 'Error while fetching or saving expireAt')
      return false
    }
  }

  if (profile.expireAt) {
    const score: number = profile.isGKMinted ? 1 : 2
    await cache.zadd(`${CacheKeys.PROFILE_GK_NFT}_${chainId}`, score, numericTokenId)
  }

  return !!profile.isGKMinted
}
