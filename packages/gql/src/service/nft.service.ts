import axios,  { AxiosError, AxiosInstance, AxiosResponse } from 'axios'
import axiosRetry, { IAxiosRetryConfig } from 'axios-retry'
import { BigNumber, ethers } from 'ethers'
import { chunk, differenceBy } from 'lodash'
import QueryStream from 'pg-query-stream'
import { Writable } from 'stream'
import * as typeorm from 'typeorm'

import { Upload } from '@aws-sdk/lib-storage'
import { cache, CacheKeys } from '@nftcom/cache'
import { assetBucket } from '@nftcom/gql/config'
import { gql, Pageable } from '@nftcom/gql/defs'
import { Context } from '@nftcom/gql/defs'
import { pagination } from '@nftcom/gql/helper'
import { getCollectionDeployer } from '@nftcom/gql/service/alchemy.service'
import {
  contentTypeFromExt,
  extensionFromFilename,
  fetchWithTimeout,
  findDuplicatesByProperty,
  generateSVGFromBase64String,
  generateWeight,
  getAWSConfig,
  getLastWeight,
  midWeight,
  processIPFSURL,
  s3ToCdn,
  saveUsersForAssociatedAddress,
} from '@nftcom/gql/service/core.service'
import { NFTPortRarityAttributes } from '@nftcom/gql/service/nftport.service'
import { retrieveNFTDetailsNFTPort } from '@nftcom/gql/service/nftport.service'
import { SearchEngineService } from '@nftcom/gql/service/searchEngine.service'
import { paginatedActivitiesBy } from '@nftcom/gql/service/txActivity.service'
import { _logger, contracts, db, defs, entity, helper, provider, typechain } from '@nftcom/shared'
import * as Sentry from '@sentry/node'

import { nft as nftLoader } from '../dataloader'

const repositories = db.newRepositories()
const logger = _logger.Factory(_logger.Context.Misc, _logger.Context.GraphQL)
const seService = SearchEngineService()

const CRYPTOPUNK = '0xb47e3cd837ddf8e4c57f05d70ab865de6e193bbb'
const ALCHEMY_API_URL = process.env.ALCHEMY_API_URL
const ALCHEMY_API_URL_GOERLI = process.env.ALCHEMY_API_URL_GOERLI
const MAX_SAVE_COUNTS = 500
const exceptionBannerUrlRegex = /https:\/\/cdn.nft.com\/collections\/1\/.*banner\.*/
const TEST_WALLET_ID = 'test'

let alchemyUrl: string
let chainId = process.env.CHAIN_ID

interface OwnedNFT {
  contract: {
    address: string
  }
  id: {
    tokenId: string
    tokenMetadata?: any
  }
  title?: string
  metadata?: any
}

interface ContractMetaDataResponse {
  address: string
  contractMetadata: {
    name: string
    symbol: string
    totalSupply: string
    tokenType: string
    openSea: {
      floorPrice: number
      collectionName: string
      imageUrl: string
      safelistRequestStatus: string
    }
  }
}

interface NFTMetaDataResponse {
  contract: {
    address: string
  }
  id: {
    tokenId: string
    tokenMetadata?: {
      tokenType?: string
    }
  }
  title: string
  description: string
  media?: {
    uri?: {
      raw: string
      gateway: string
    }
  }
  metadata?: {
    image?: string
    attributes?: Array<Record<string, any>>
  }
  timeLastUpdated: string
}

type EdgeWithWeight = {
  id: string
  weight?: string
  hide?: boolean
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

const checkSumOwner = (owner: string): string | undefined => {
  try {
    return helper.checkSum(owner)
  } catch (err) {
    logger.error(err, `Unable to checkSum owner: ${owner}`)
  }
  return
}

export const initiateWeb3 = (cid?: string): void => {
  chainId = cid || process.env.CHAIN_ID // attach default value
  alchemyUrl = Number(chainId) == 1 ? ALCHEMY_API_URL : ALCHEMY_API_URL_GOERLI
}

export const getAlchemyInterceptor = (
  chainId: string,
): AxiosInstance => {
  const alchemyInstance = axios.create({
    baseURL: Number(chainId || process.env.CHAIN_ID) == 1 ? ALCHEMY_API_URL : ALCHEMY_API_URL_GOERLI,
    headers: {
      'Accept': 'application/json',
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
        const retry_after = Number(err.response.headers['retry-after'])
        if (retry_after) {
          return retry_after
        }
      }
      return axiosRetry.exponentialDelay(retryCount)
    },
  }
  axiosRetry(alchemyInstance,  retryOptions)
  return alchemyInstance
}

export const getNFTsFromAlchemyPage = async (
  owner: string,
  { contracts, withMetadata = true, pageKey }: {
    contracts?: string[]
    withMetadata?: boolean
    pageKey?: string
  } = {},
): Promise<[OwnedNFT[], string | undefined]> => {
  try {
    const alchemyInstance: AxiosInstance = await getAlchemyInterceptor(chainId)
    let queryParams = `owner=${owner}`

    if (contracts) {
      queryParams += `&contractAddresses[]=${contracts}`
    }

    if (withMetadata) {
      queryParams += `&withMetadata=${withMetadata}`
    }

    if (pageKey) {
      queryParams += `&pageKey=${pageKey}`
    }

    const response: AxiosResponse = await alchemyInstance.get(`/getNFTs?${queryParams}`)

    if (response?.data?.ownedNfts) {
      return [response.data.ownedNfts as OwnedNFT[], response.data.pageKey]
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
): Promise<OwnedNFT[]> => {
  try {
    let pageKey
    const ownedNFTs: Array<OwnedNFT> = []
    const alchemyInstance: AxiosInstance = await getAlchemyInterceptor(chainId)
    let queryParams = `owner=${owner}`

    if (contracts) {
      queryParams += `&contractAddresses[]=${contracts}`
    }

    if (withMetadata) {
      queryParams += `&withMetadata=${withMetadata}`
    }

    const response: AxiosResponse = await alchemyInstance.get(`/getNFTs?${queryParams}`)

    if (response?.data?.ownedNfts) {
      ownedNFTs.push(...response?.data?.ownedNfts as OwnedNFT[])
      if (response?.data?.pageKey) {
        pageKey = response?.data?.pageKey
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const res: AxiosResponse = await alchemyInstance.get(`/getNFTs?${queryParams}&pageKey=${pageKey}`)

          if (res?.data?.ownedNfts) {
            ownedNFTs.push(...res?.data?.ownedNfts as OwnedNFT[])
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

export const getOwnersForNFT = async (
  nft: typeorm.DeepPartial<entity.NFT>,
): Promise<string[]> => {
  try {
    initiateWeb3(nft.chainId)
    const contract = ethers.utils.getAddress(nft.contract)
    
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

/**
 * Takes a bunch of NFTs (pulled from the DB), and checks
 * that the given owner is still correct.
 *
 * If not, deletes the NFT record from the DB.
 */
export const filterNFTsWithAlchemy = async (
  nfts: Array<typeorm.DeepPartial<entity.NFT>>,
  owner: string,
): Promise<void> => {
  const contracts = []
  const seen = {}
  nfts.forEach((nft: typeorm.DeepPartial<entity.NFT>) => {
    const key = ethers.utils.getAddress(nft.contract)
    if (!seen[key]) {
      contracts.push(key)
      seen[key] = true
    }
  })
  try {
    const ownedNfts = await getNFTsFromAlchemy(owner, contracts)
    const checksum = ethers.utils.getAddress

    const newOwnerNFTs = new Map()
    await Promise.allSettled(
      nfts.map(async (dbNFT: typeorm.DeepPartial<entity.NFT>) => {
        const index = ownedNfts.findIndex((ownedNFT: OwnedNFT) => {
          // logger.log(`&&&***&&& precheck filterNFTsWithAlchemy 1: ownedNFT.id: ${ownedNFT?.id}, dbNFT.id: ${dbNFT?.id} ||| checksum(ownedNFT?.contract?.address) ${checksum(ownedNFT?.contract?.address)}, checksum(dbNFT?.contract) ${checksum(dbNFT?.contract)}, BigNumber.from(ownedNFT?.id?.tokenId) ${BigNumber.from(ownedNFT?.id?.tokenId)}, BigNumber.from(dbNFT?.tokenId) ${BigNumber.from(dbNFT?.tokenId)}`)
          return checksum(ownedNFT?.contract?.address) === checksum(dbNFT?.contract) &&
          BigNumber.from(ownedNFT?.id?.tokenId).eq(BigNumber.from(dbNFT?.tokenId))
        })

        // We didn't find this NFT entry in the most recent list of
        // this user's owned tokens for this contract/collection.
        if (index === -1) {
          try {
            // logger.log(`&&& filterNFTsWithAlchemy 1: thatEntityId ${dbNFT?.id}, owner: ${owner}, ownedNfts: ${JSON.stringify(ownedNfts)}`)
            await repositories.edge.hardDelete({ thatEntityId: dbNFT?.id, edgeType: defs.EdgeType.Displays } )
            const owners = await getOwnersForNFT(dbNFT)
            if (owners.length) {
              if (owners.length > 1) {
                // This is ERC1155 token with multiple owners, so we don't update owner for now and delete NFT
                // logger.log(`&&& filterNFTsWithAlchemy 2: dbNFT?.id ${dbNFT?.id}`)
                await repositories.edge.hardDelete({ thatEntityId: dbNFT?.id } )
                  .then(() => repositories.nft.hardDelete({
                    id: dbNFT?.id,
                  }))
                await seService.deleteNFT(dbNFT?.id)
              } else {
                const newOwner = owners[0]
                newOwnerNFTs.has(newOwner)
                  ? newOwnerNFTs.get(newOwner).push(dbNFT)
                  : newOwnerNFTs.set(newOwner, [dbNFT])
              }
            }
          } catch (err) {
            logger.error(`Error in filterNFTsWithAlchemy: ${err}`)
            Sentry.captureMessage(`Error in filterNFTsWithAlchemy: ${err}`)
          }
        }
      }),
    )
    for (const [owner, nftsToUpdate] of newOwnerNFTs) {
      const csOwner = checkSumOwner(owner)
      const wallet = await repositories.wallet.findByChainAddress(nftsToUpdate[0].chainId, csOwner)
      await Promise.allSettled(
        nftsToUpdate.map((nft) => {
          repositories.nft.updateOneById(nft?.id, {
            userId: wallet?.userId || null, // null if user has not been created yet by connecting to NFT.com
            walletId: wallet?.id || null, // null if wallet has not been connected to NFT.com
            owner: csOwner,
          })
        }),
      )
      await seService.indexNFTs(nftsToUpdate)
    }
  } catch (err) {
    logger.error(err, 'Error in filterNFTsWithAlchemy -- top level')
    Sentry.captureMessage(`Error in filterNFTsWithAlchemy: ${err}`)
    throw err
  }
}

const getNFTMetaDataFromAlchemy = async (
  contractAddress: string,
  tokenId: string,
  // optionalWeb3: (AlchemyWeb3 | undefined) = undefined,
): Promise<NFTMetaDataResponse | undefined> => {
  try {
    const alchemyInstance: AxiosInstance = await getAlchemyInterceptor(chainId)
    const queryParams = `contractAddress=${contractAddress}&tokenId=${tokenId}`
    const response: AxiosResponse = await alchemyInstance.get(`/getNFTMetadata?${queryParams}`)

    return response.data as NFTMetaDataResponse
  } catch (err) {
    Sentry.captureMessage(`Error in getNFTMetaDataFromAlchemy: ${err}`)
    return undefined
  }
}

export const getContractMetaDataFromAlchemy = async (
  contractAddress: string,
): Promise<ContractMetaDataResponse | undefined> => {
  try {
    const key = `getContractMetaDataFromAlchemy${alchemyUrl}_${ethers.utils.getAddress(contractAddress)}`
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
  type:  defs.NFTType,
): Promise<string> => {
  try {
    if (type === defs.NFTType.ERC721) {
      const tokenContract = typechain.ERC721__factory.connect(
        contractAddress,
        provider.provider(Number(chainId)),
      )
      return tokenContract.name().catch(() => Promise.resolve('Unknown Name'))
    } else if (type === defs.NFTType.ERC1155 || type === defs.NFTType.UNKNOWN) {
      const tokenContract = typechain.ERC1155__factory.connect(
        contractAddress,
        provider.provider(Number(chainId)),
      )
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

export const getNFTsForCollection = async (
  contractAddress: string,
): Promise<any> => {
  try {
    const key = `getNFTsForCollection${alchemyUrl}_${ethers.utils.getAddress(contractAddress)}`
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

export const getCollectionNameFromDataProvider = async (
  contract: string,
  chainId: string,
  type:  defs.NFTType,
): Promise<string> => {
  try {
    const contractDetails: ContractMetaDataResponse = await getContractMetaDataFromAlchemy(contract)

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

  const nameFromContract: string = await getCollectionNameFromContract(
    contract,
    chainId,
    type,
  )

  return nameFromContract
}

export const updateCollectionForNFTs = async (
  nfts: Array<entity.NFT>,
): Promise<void> => {
  try {
    const seen = {}
    const nonDuplicates: Array<entity.NFT> = []
    nfts.map((nft: entity.NFT) => {
      const key = ethers.utils.getAddress(nft.contract)
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
          where: { contract: ethers.utils.getAddress(nft.contract) },
        })
        if (!collection) {
          const collectionName = await getCollectionNameFromDataProvider(
            nft.contract,
            nft.chainId,
            nft.type,
          )
          const collectionDeployer = await getCollectionDeployer(nft.contract, nft.chainId)
          logger.debug('new collection', { collectionName, contract: nft.contract, collectionDeployer })

          collections.push({
            contract: ethers.utils.getAddress(nft.contract),
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
      nfts.map(async (nft) => {
        const collection = await repositories.collection.findOne({
          where: { contract: ethers.utils.getAddress(nft.contract) },
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
      const traitExists: NFTPortRarityAttributes = rarityAttributes.find(
        (rarityAttribute: NFTPortRarityAttributes) => {
          if (rarityAttribute?.trait_type === attribute?.type
            && String(rarityAttribute?.value|| '').trim() === String(attribute?.value || '').trim()) {
            return rarityAttribute
          }
        },
      )
      let traitsToBePushed: defs.Trait = {
        ...attribute,
      }

      if (traitExists) {
        traitsToBePushed = {
          ...traitsToBePushed,
          type: traitExists?.trait_type || attribute?.type || '',
          value: traitExists?.value || attribute?.value|| '',
        }
        if (traitExists?.statistics?.prevalence) {
          traitsToBePushed = {
            ...traitsToBePushed,
            rarity: String(traitExists.statistics.prevalence || '0'),
          }
        }
      }

      traits.push(
        traitsToBePushed,
      )
    }
  }
  return traits
}

// helper function to get traits for metadata, nftPort optional
export const getMetadata = (metadata: any, nftPortDetails: any = undefined): Array<defs.Trait> => {
  const traits: Array<defs.Trait> = []

  if (Array.isArray(metadata?.attributes)) {
    metadata?.attributes.map((trait) => {
      let value = trait?.value || trait?.trait_value
      value = typeof value === 'string' ? value : JSON.stringify(value)
      traits.push(({
        type: trait?.trait_type,
        value,
      }))
    })
  } else if (Array.isArray(metadata?.message?.attributes)) { // edge case for alchemy
    metadata?.message?.attributes.map((trait) => {
      let value = trait?.value || trait?.trait_value
      value = typeof value === 'string' ? value : JSON.stringify(value)
      traits.push(({
        type: trait?.trait_type,
        value,
      }))
    })
  } else if (Array.isArray(metadata?.enhanced_cattributes)) {
    metadata?.enhanced_cattributes.map((trait) => {
      let value = trait?.description
      value = typeof value === 'string' ? value : JSON.stringify(value)
      traits.push(({
        type: trait?.type,
        value,
      }))
    })
  } else if (Array.isArray(nftPortDetails?.nft?.metadata?.attributes)) { // nftport fallback
    nftPortDetails?.nft?.metadata?.attributes.map((trait) => {
      let value = trait?.value || trait?.trait_value
      value = typeof value === 'string' ? value : JSON.stringify(value)
      traits.push(({
        type: trait?.trait_type,
        value,
      }))
    })
  } else if (Array.isArray(nftPortDetails?.metadata?.traits)) { // nft port collection nft metadata import in streams
    nftPortDetails?.metadata?.traits.map((trait) => {
      let value = trait?.value
      value = typeof value === 'string' ? value : JSON.stringify(value)
      traits.push(({
        type: trait?.trait_type,
        value,
      }))
    })
  } else {
    if (metadata?.attributes) {
      Object.keys(metadata?.attributes).map(keys => {
        let value = metadata?.attributes?.[keys]
        value = typeof value === 'string' ? value : JSON.stringify(value)
        traits.push(({
          type: keys,
          value,
        }))
      })
    }
  }

  if(Array.isArray(nftPortDetails?.nft?.attributes)) {
    return nftTraitBuilder(traits, nftPortDetails?.nft?.attributes)
  }

  return traits
}

export const getNftName = (
  nftMetadata: any,
  nftPortDetails: any = undefined,
  contractMetadata: any = undefined,
  tokenId: string = undefined,
): string => {
  return nftPortDetails?.nft?.contract_address?.toLowerCase() == CRYPTOPUNK
    ? nftPortDetails?.nft?.metadata?.name
    : nftMetadata?.title
    || nftPortDetails?.nft?.metadata?.name
    || (tokenId
      ? [`${contractMetadata?.contractMetadata?.name || contractMetadata?.contractMetadata?.openSea?.collectionName}`, BigNumber.from(tokenId).toString()].join(' ')
      : '')
}

export const getNftDescription = (
  nftMetadata: any,
  nftPortDetails: any = undefined,
): string => {
  return nftMetadata?.description || nftMetadata?.metadata?.bio || nftPortDetails?.nft?.metadata?.description
}

const FALLBACK_IMAGE_URL = process.env.FALLBACK_IMAGE_URL || 'https://cdn.nft.com/optimizedLoader2.webp'
export const getNftImage = (
  metadata: any,
  nftPortDetails: any = undefined,
): string => {
  return (metadata?.image?.indexOf('copebear') >= 0 || nftPortDetails?.nft?.contract_address?.toLowerCase() == CRYPTOPUNK)
    ? nftPortDetails?.nft?.cached_file_url
    : metadata?.image || metadata?.image_url || metadata?.image_url_cdn || metadata?.tokenUri?.gateway ||
      metadata?.tokenUri?.raw || nftPortDetails?.nft?.cached_file_url ||
        (metadata?.image_data ? generateSVGFromBase64String(metadata?.image_data) : FALLBACK_IMAGE_URL)
}

export const getNftType = (
  nftMetadata: any,
  nftPortDetails: any = undefined,
): defs.NFTType | undefined => {
  if (nftPortDetails?.contract?.type == 'CRYPTO_PUNKS' || nftPortDetails?.contract_address?.toLowerCase() == CRYPTOPUNK) {
    return defs.NFTType.CRYPTO_PUNKS
  } else if ((nftMetadata?.id?.tokenMetadata?.tokenType || nftPortDetails?.contract?.type) === 'ERC721') {
    return defs.NFTType.ERC721
  } else if ((nftMetadata?.id?.tokenMetadata?.tokenType || nftPortDetails?.contract?.type) === 'ERC1155') {
    return defs.NFTType.ERC1155
  } else if (nftMetadata?.title.endsWith('.eth') || nftPortDetails?.nft?.metadata?.name.endsWith('.eth')) { // if token is ENS token...
    return defs.NFTType.UNKNOWN
  } else {
    return undefined
  }
}

const getNFTMetaData = async (
  contract: string,
  tokenId: string,
  chainId: string,
  refreshMetadata = true,
): Promise<NFTMetaData | undefined> => {
  try {
    const nftMetadata: NFTMetaDataResponse = await getNFTMetaDataFromAlchemy(
      contract,
      tokenId,
    )

    const nftPortDetails = await retrieveNFTDetailsNFTPort(
      contract,
      tokenId,
      chainId || process.env.CHAIN_ID,
      refreshMetadata,
    )

    if (!nftMetadata) return

    const contractMetadata = await getContractMetaDataFromAlchemy(contract)

    const metadata = nftMetadata?.metadata as any

    const name = getNftName(nftMetadata, nftPortDetails, contractMetadata, tokenId)

    // For CryptoKitties, their metadata response format is different from original one
    const description = getNftDescription(nftMetadata, nftPortDetails)

    const image = getNftImage(metadata, nftPortDetails)

    const type: defs.NFTType = getNftType(nftMetadata, nftPortDetails)
    if (!type) {
      // If it's missing NFT token type, we should throw error
      logger.error(`token type of NFT is wrong for contract ${contract} and tokenId ${tokenId}`)
      return Promise.reject(`token type of NFT is wrong for contract ${contract} and tokenId ${tokenId}`)
    }
    const traits: Array<defs.Trait> = getMetadata(metadata, nftPortDetails)

    return {
      type,
      name,
      description,
      image,
      traits,
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
  nft: OwnedNFT,
  userId: string,
  wallet: entity.Wallet,
  chainId: string,
): Promise<entity.NFT | undefined> => {
  try {
    const existingNFT = await repositories.nft.findOne({
      where: {
        contract: ethers.utils.getAddress(nft.contract.address),
        tokenId: BigNumber.from(nft.id.tokenId).toHexString(),
        chainId: chainId,
      },
    })

    const walletChainId =  wallet?.chainId || process.env.CHAIN_ID

    let type, name, description, image
    let traits = []
    if (nft.id.tokenMetadata && nft.id.tokenMetadata?.tokenType) {
      if (nft.contract.address.toLowerCase() === CRYPTOPUNK) {
        type = defs.NFTType.CRYPTO_PUNKS
      } else if (nft.id.tokenMetadata?.tokenType === 'ERC721') {
        type = defs.NFTType.ERC721
      } else if (nft.id.tokenMetadata?.tokenType === 'ERC1155') {
        type = defs.NFTType.ERC1155
      } else if (nft.title && nft.title?.endsWith('.eth')) { // if token is ENS token...
        type = defs.NFTType.UNKNOWN
      }
    }

    if (nft.metadata) {
      if (nft.metadata?.name) name = nft.metadata?.name
      if (nft.metadata?.image) image = nft.metadata?.image
      if (nft.metadata?.description) description = nft.metadata?.description
      if (nft.metadata?.attributes && Array.isArray(nft.metadata?.attributes)) {
        nft.metadata?.attributes.map((trait) => {
          let value = trait?.value || trait?.trait_value
          let rarity = trait?.rarity
          value = typeof value === 'string' ? value : JSON.stringify(value)
          rarity = typeof rarity === 'string' ? rarity : JSON.stringify(rarity)
          traits.push(({
            type: trait?.trait_type,
            value,
            rarity,
          }))
        })
      }
    }
    // if we are not available to get nft metadata from getNFTs api, we try to get information from getNFTMetadata or NFTPort
    if (!type || !name || !description || !image || !traits.length) {
      const metadata = await getNFTMetaData(nft.contract.address, nft.id.tokenId, walletChainId)
      if (!metadata) return undefined
      type = metadata.type
      name = metadata.name
      description = metadata.description
      image = metadata.image
      traits = metadata.traits
    }

    // if this NFT is not existing on our db, we save it...
    if (!existingNFT) {
      const csOwner = checkSumOwner(wallet.address)
      const savedNFT = await repositories.nft.save({
        chainId: walletChainId,
        userId,
        walletId: wallet.id,
        owner: csOwner,
        contract: ethers.utils.getAddress(nft.contract.address),
        tokenId: BigNumber.from(nft.id.tokenId).toHexString(),
        type,
        metadata: {
          name,
          description,
          imageURL: image,
          traits: traits,
        },
      })
      return savedNFT
    } else {
      // if this NFT is existing and owner changed, we change its ownership...
      if (existingNFT.userId !== userId || existingNFT.walletId !== wallet.id) {
        // we remove edge of previous profile
        // logger.log(`&&& updateNFTOwnershipAndMetadata: existingNFT.userId ${existingNFT.userId}, userId ${userId}, existingNFT.walletId ${existingNFT.walletId}, walletId ${walletId}`)
        await repositories.edge.hardDelete({ thatEntityId: existingNFT.id, edgeType: defs.EdgeType.Displays } )

        // if this NFT is a profile NFT...
        if (ethers.utils.getAddress(existingNFT.contract) ==
          ethers.utils.getAddress(contracts.nftProfileAddress(chainId))) {
          const previousWallet = await repositories.wallet.findById(existingNFT.walletId)

          if (previousWallet) {
            const profile = await repositories.profile.findOne({ where: {
              tokenId: BigNumber.from(existingNFT.tokenId).toString(),
              ownerWalletId: previousWallet.id,
              ownerUserId: previousWallet.userId,
            } })
            // if this NFT was previous owner's preferred profile...
            if (profile && profile?.id === previousWallet.profileId) {
              await repositories.wallet.updateOneById(previousWallet.id, {
                profileId: null,
              })
            }
          } else {
            logger.info(`previous wallet for existing NFT ${existingNFT.id} is undefined`)
          }
        }

        const csOwner = checkSumOwner(wallet.address)
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
        return updatedNFT
      } else {
        const isTraitSame = (existingNFT.metadata.traits.length == traits.length) &&
          existingNFT.metadata.traits.every(function(element, index) {
            return element.type === traits[index].type && element.value === traits[index].value
          })
        // if ownership's not changed and just metadata changed, we update only metadata...
        if (existingNFT.type !== type ||
          existingNFT.metadata.name !== name ||
          existingNFT.metadata.description !== description ||
          existingNFT.metadata.imageURL !== image ||
          !isTraitSame
        ) {
          const csOwner = checkSumOwner(wallet.address)
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
          return updatedNFT
        } else {
          logger.debug('No need to update owner and metadata', existingNFT.contract)
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

export const indexNFTsOnSearchEngine = async (
  nfts: Array<entity.NFT>,
): Promise<void> => {
  try {
    await seService.indexNFTs(nfts)
  } catch (err) {
    logger.error(`Error in indexNFTsOnSearchEngine: ${err}`)
    Sentry.captureMessage(`Error in indexNFTsOnSearchEngine: ${err}`)
    throw err
  }
}

export const indexCollectionsOnSearchEngine = async (
  collections: Array<entity.Collection>,
): Promise<void> => {
  try {
    await seService.indexCollections(collections)
  } catch (err) {
    logger.error(`Error in indexCollectionsOnSearchEngine: ${err}`)
    Sentry.captureMessage(`Error in indexCollectionsOnSearchEngine: ${err}`)
    throw err
  }
}

/**
 * update wallet NFTs using data from alchemy api
 * @param userId
 * @param wallet
 * @param chainId
 */
export const updateWalletNFTs = async (
  userId: string,
  wallet: entity.Wallet,
  chainId: string,
): Promise<void> => {
  try {
    logger.info(`[updateWalletNFTs] Updating wallet NFTs for ${wallet.address}, ${userId}`)
    let pageKey = undefined
    do {
      const [ownedNFTs, nextPageKey] = await getNFTsFromAlchemyPage(wallet.address, { pageKey })
      pageKey = nextPageKey
      logger.info({ totalOwnedNFTs: ownedNFTs.length, userId, wallet }, `[updateWalletNFTs] Updating wallet NFTs for ${wallet.address}`)
      const savedNFTs: entity.NFT[] = []
      try {
        await Promise.allSettled(
          ownedNFTs.map(async (nft) => {
            const savedNFT = await updateNFTOwnershipAndMetadata(nft, userId, wallet, chainId)
            if (savedNFT) savedNFTs.push(savedNFT)
          }),
        )
      } catch (err) {
        logger.error({ err, totalOwnedNFTs: ownedNFTs.length, userId, wallet }, `[updateWalletNFTs] error 1: ${err}`)
        Sentry.captureMessage(`[updateWalletNFTs] error 1: ${err}`)
      }
      if (savedNFTs.length) {
        logger.info({ savedNFTsSize: savedNFTs.length, userId, wallet }, `[updateWalletNFTs] Updating collection and Syncing search index for wallet ${wallet.address}`)
        await updateCollectionForNFTs(savedNFTs)
        await indexNFTsOnSearchEngine(savedNFTs)
      }
    } while (pageKey)
  } catch (err) {
    logger.error(`[updateWalletNFTs] error 2: ${err}`)
    Sentry.captureMessage(`[updateWalletNFTs] error 2: ${err}`)
  }
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
    const nfts = await repositories.nft.find({ where: {
      userId: userId,
      walletId: walletId,
      chainId: chainId,
    } })
    if (!nfts.length) {
      return
    }
    const nftsChunks: entity.NFT[][] = chunk(
      nfts,
      20,
    )
    await Promise.allSettled(
      nftsChunks.map(async (nftChunk: entity.NFT[]) => {
        try {
          await filterNFTsWithAlchemy(nftChunk, walletAddress)
        } catch (err) {
          logger.error(`Error in checkNFTContractAddresses: ${err}`)
          Sentry.captureMessage(`Error in checkNFTContractAddresses: ${err}`)
        }
      }),
    )
  } catch (err) {
    logger.error(`Error in checkNFTContractAddresses: ${err}`)
    Sentry.captureMessage(`Error in checkNFTContractAddresses: ${err}`)
    return
  }
}

export const refreshNFTMetadata = async (
  nft: entity.NFT,
): Promise<entity.NFT> => {
  try {
    // hard refresh for now
    // until Alchemy SDK incorporates this
    // TODO: remove in future
    const alchemy_api_url = nft.chainId === '1' ? process.env.ALCHEMY_API_URL : process.env.ALCHEMY_API_URL_GOERLI
    await axios.get(`${alchemy_api_url}/getNFTMetadata?contractAddress=${nft.contract}&tokenId=${BigNumber.from(nft.tokenId).toString()}&tokenType=${nft.type == defs.NFTType.ERC1155 ? 'erc1155' : 'erc721'}&refreshCache=true`)

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
    const isTraitSame = (nft.metadata.traits.length == traits.length) &&
      nft.metadata.traits.every(function(element, index) {
        return element.type === traits[index].type && element.value === traits[index].value
      })
    // if metadata changed, we update metadata...
    if (nft.type !== type ||
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

export const getOwnersOfGenesisKeys = async (
  chainId: string,
): Promise<object> => {
  const contract = contracts.genesisKeyAddress(chainId)
  if (chainId !== '1' && chainId !== '5') return []
  try {
    const key = `${CacheKeys.GENESIS_KEY_OWNERS}_${chainId}`
    const cachedData = await cache.get(key)
    if (cachedData) {
      return JSON.parse(cachedData) as object
    }
    // until Alchemy SDK incorporates this
    // TODO: remove in future
    const alchemy_api_url = chainId === '1' ? process.env.ALCHEMY_API_URL : process.env.ALCHEMY_API_URL_GOERLI
    const res = await axios.get(`${alchemy_api_url}/getOwnersForCollection?contractAddress=${contract}`)
    if (res && res?.data && res.data?.ownerAddresses) {
      const gkOwners = res.data.ownerAddresses as string[]
      const gkOwnersObj = gkOwners.reduce((acc, curr) => {
        acc[checkSumOwner(curr)] = true
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

export const executeUpdateNFTsForProfile = async (
  profileId: string,
  chainId: string,
): Promise<void> => {
  try {
    const recentlyRefreshed: string = await cache.zscore(`${CacheKeys.UPDATED_NFTS_PROFILE}_${chainId}`, profileId)
    if (recentlyRefreshed) {
      // remove profile from cache which store recently refreshed
      await cache.zrem(`${CacheKeys.UPDATED_NFTS_PROFILE}_${chainId}`, [profileId])
    }
    const inProgress = await cache.zscore(`${CacheKeys.PROFILES_IN_PROGRESS}_${chainId}`, profileId)
    if (inProgress) {
      await cache.zrem(`${CacheKeys.PROFILES_IN_PROGRESS}_${chainId}`, [profileId])
    }
    const inQueue = await cache.zscore(`${CacheKeys.UPDATE_NFTS_PROFILE}_${chainId}`, profileId)
    if (!inQueue) {
      // add to NFT cache list
      await cache.zadd(`${CacheKeys.UPDATE_NFTS_PROFILE}_${chainId}`, 'INCR', 1, profileId)
    }
  } catch (err) {
    logger.error(`Error in executeUpdateNFTsForProfile: ${err}`)
    Sentry.captureMessage(`Error in executeUpdateNFTsForProfile: ${err}`)
    throw err
  }
}

export const getOwnersOfNFTProfile = async (
  chainId: string,
): Promise<object> => {
  const contract = contracts.nftProfileAddress(chainId)
  if (chainId !== '1' && chainId !== '5') return []
  try {
    const key = `${CacheKeys.NFT_PROFILE_OWNERS}_${chainId}`
    const cachedData = await cache.get(key)
    if (cachedData) {
      return JSON.parse(cachedData) as object
    }

    const alchemy_api_url = chainId === '1' ? process.env.ALCHEMY_API_URL : process.env.ALCHEMY_API_URL_GOERLI
    const res = await axios.get(`${alchemy_api_url}/getOwnersForCollection?contractAddress=${contract}`)
    if (res && res?.data && res.data?.ownerAddresses) {
      const profileOwners = res.data.ownerAddresses as string[]
      const profileOwnersObj = profileOwners.reduce((acc, curr) => {
        acc[checkSumOwner(curr)] = true
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

export const hideAllNFTs = async (
  repositories: db.Repository,
  profileId: string,
): Promise<void> => {
  try {
    const edges = await repositories.edge.find({ where: {
      thisEntityType: defs.EntityType.Profile,
      thisEntityId: profileId,
      edgeType: defs.EdgeType.Displays,
      thatEntityType: defs.EntityType.NFT,
      hide: false,
    } })
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
  profileId: string, hide: boolean, nfts: entity.NFT[], lastWeight?: string): Promise<string> => {
  try {
    logger.info(`saveEdgesForNFTs: ${profileId} ${hide} ${nfts.length}`)
    const startTime = new Date().getTime()

    // filter nfts are not added to edge yet...
    const profileNFTs = await repositories.nft.findByEdgeProfileDisplays(profileId, true, nfts)
    const nftsToBeAdded = differenceBy(nfts, profileNFTs, 'id')

    // generate weights for nfts...
    let weight = lastWeight || await getLastWeight(repositories, profileId)
    const edgesWithWeight = []
    for (let i = 0; i < nftsToBeAdded.length; i++) {
      const newWeight = generateWeight(weight)
      edgesWithWeight.push({
        thisEntityType: defs.EntityType.Profile,
        thatEntityType: defs.EntityType.NFT,
        thisEntityId: profileId,
        thatEntityId: nftsToBeAdded[i].id,
        edgeType: defs.EdgeType.Displays,
        weight: newWeight,
        hide: hide,
      })
      weight = newWeight
    }

    logger.info(`saveEdgesForNFTs: ${profileId} edges to save = ${edgesWithWeight.length}`)
    // save nfts to edge...
    await repositories.edge.saveMany(edgesWithWeight, { chunk: MAX_SAVE_COUNTS })
    logger.info(`saveEdgesForNFTs: ${profileId} ${hide} ${nfts.length}, weight = ${weight} done, time = ${new Date().getTime() - startTime} ms`)
    return weight
  } catch (err) {
    logger.error(err, `Error in saveEdgesForNFTs: ${err}`)
    Sentry.captureMessage(`Error in saveEdgesForNFTs: ${err}`)
    await cache.zrem(`${CacheKeys.PROFILES_IN_PROGRESS}_${chainId}`, [profileId])
    throw err
  }
}

export const saveEdgesWithWeight = async (
  profileId: string,
  hide: boolean,
  { nfts, walletId }: { nfts?: entity.NFT[]; walletId?: string} = {},
): Promise<void> => {
  try {
    if (nfts) {
      await saveEdgesForNFTs(profileId, hide, nfts)
    } else if (walletId) {
      const pgClient = db.getPgClient(true)
      await new Promise<void>((resolve, reject) => {
        pgClient.connect((err, client, done) => {
          let weight: string
          if (err) throw err
          const batch = []
          const batchSize = 200
          const query = new QueryStream(
            `SELECT
              *
            FROM
              nft
            WHERE
              "walletId" = $1
              AND "chainId" = $2`,
            [walletId, chainId],
            { batchSize, highWaterMark: 1000 },
          )

          logger.info(`Querying nfts for profileId ${profileId}, wallet ${walletId}...`)
          const stream = client.query(query)
          stream.on('end', async () => {
            if (batch.length) {
              await saveEdgesForNFTs(profileId, hide, batch.splice(0), weight)
            }
            done()

            logger.info(`saveEdgesForNFTs for profileId ${profileId}, wallet ${walletId} done`)
            resolve()
          })
          stream.on('error', (err) => {
            reject(err)
          })
          const saveEdges = new Writable({
            objectMode: true,
            async write(nft, _encoding, callback) {
              batch.push(nft)
              if (batch.length === batchSize) {
                weight = await saveEdgesForNFTs(profileId, hide, batch.splice(0, batchSize), weight)
              }
              callback()
            },
          })
          stream.pipe(saveEdges)
        })
      })
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
      await saveEdgesWithWeight(profileId, false, { walletId })
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

export const showNFTs = async (
  showNFTIds: string[],
  profileId: string,
  chainId: string,
): Promise<void> => {
  try {
    const nfts = []
    await Promise.allSettled(
      showNFTIds.map(async (id) => {
        const existingNFT = await repositories.nft.findOne({ where: { id, chainId } })
        if (existingNFT) nfts.push(existingNFT)
      }),
    )
    if (nfts.length) {
      await saveEdgesWithWeight(profileId, false, { nfts })
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
      await cache.del([`${CacheKeys.PROFILE_SORTED_NFTS}_${chainId}_${profileId}`, `${CacheKeys.PROFILE_SORTED_VISIBLE_NFTS}_${chainId}_${profileId}`])
      return
    } else if (hideAll) {
      await hideAllNFTs(repositories, profileId)
      await cache.del([`${CacheKeys.PROFILE_SORTED_NFTS}_${chainId}_${profileId}`, `${CacheKeys.PROFILE_SORTED_VISIBLE_NFTS}_${chainId}_${profileId}`])
      return
    } else {
      let clearCache = false
      if (showNFTIds?.length) {
        await showNFTs(showNFTIds, profileId, chainId)
        clearCache = true
      }
      if (hideNFTIds && hideNFTIds?.length) {
        await Promise.allSettled(
          hideNFTIds?.map(async (id) => {
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
        await cache.del([`${CacheKeys.PROFILE_SORTED_NFTS}_${chainId}_${profileId}`, `${CacheKeys.PROFILE_SORTED_VISIBLE_NFTS}_${chainId}_${profileId}`])
      }
    }
  } catch (err) {
    logger.error(`Error in changeNFTsVisibility: ${err}`)
    Sentry.captureMessage(`Error in changeNFTsVisibility: ${err}`)
    throw err
  }
}

export const updateNFTsOrder = async (
  profileId: string,
  orders: Array<NFTOrder>,
): Promise<void> => {
  try {
    for (let i = 0; i < orders.length; i++) {
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
          const index = edges.findIndex((edge) => edge.id === existingEdge.id)
          if (orders[i].newIndex <= 0) {
            // if new index is first place of nft order...
            if (index !== 0) {
              await repositories.edge.updateOneById(edges[0].id, {
                weight: midWeight('aaaa', edges[1].weight),
              })
              await repositories.edge.updateOneById(existingEdge.id, {
                weight: 'aaaa',
              })
            }
          } else if (orders[i].newIndex >= edges.length - 1) {
            // if new index is last place of nft order...
            if (index !== edges.length - 1) {
              await repositories.edge.updateOneById(existingEdge.id, {
                weight: generateWeight(edges[edges.length - 1].weight),
              })
            }
          } else {
            // if new index is inside nft order...
            if (index !== orders[i].newIndex) {
              await repositories.edge.updateOneById(existingEdge.id, {
                weight:
                  midWeight(edges[orders[i].newIndex - 1].weight,
                    edges[orders[i].newIndex].weight),
              })
            }
          }
        }
      }
    }
    if (orders.length) {
      const chainId = process.env.CHAIN_ID
      await cache.del([`${CacheKeys.PROFILE_SORTED_NFTS}_${chainId}_${profileId}`, `${CacheKeys.PROFILE_SORTED_VISIBLE_NFTS}_${chainId}_${profileId}`])
    }
  } catch (err) {
    logger.error(`Error in updateNFTsOrder: ${err}`)
    Sentry.captureMessage(`Error in updateNFTsOrder: ${err}`)
    throw err
  }
}

const fillEdgesWithWeight = async (profileId, nullEdges: entity.Edge[], weight?: string): Promise<string> => {
  logger.info(`#1 fillEdgesWithWeight for profileId: ${profileId} and weight: ${weight} and nullEdges: ${nullEdges.length}`)

  // fill weight of edges which have null as weight...
  weight ??= await getLastWeight(repositories, profileId)
  const edgesWithWeight: EdgeWithWeight[] = []
  for (let i = 0; i < nullEdges.length; i++) {
    const newWeight = generateWeight(weight)
    edgesWithWeight.push({
      id: nullEdges[i].id,
      weight: newWeight,
      hide: nullEdges[i].hide ?? false,
    })
    weight = newWeight
  }

  logger.info(`#2 fillEdgesWithWeight for profileId: ${profileId} and weight: ${weight} and edgesWithWeight: ${edgesWithWeight.length}`)
  await repositories.edge.saveMany(edgesWithWeight, { chunk: MAX_SAVE_COUNTS })

  logger.info(`#3 fillEdgesWithWeight for profileId: ${profileId} saved!`)
  return weight
}
export const updateEdgesWithNullWeight = async (
  profileId: string,
): Promise<void> => {
  const pgClient = db.getPgClient(true)
  await new Promise<void>((resolve, reject) => {
    pgClient.connect((err, client, done) => {
      if (err) throw err
      const batch = []
      const batchSize = 100
      let lastWeight: string = undefined
      const query = new QueryStream(
        `SELECT
          *
        FROM
          edge
        WHERE
          "thisEntityId" = $1
          AND "thisEntityType" = '${defs.EntityType.Profile}'
          AND "thatEntityType" = '${defs.EntityType.NFT}'
          AND "edgeType" = '${defs.EdgeType.Displays}'
          AND "weight" IS NULL`,
        [profileId],
        { batchSize, highWaterMark: 500 },
      )
      logger.info(`profileId ${profileId} = updateEdgesWithNullWeight: ${query}`)
      const stream = client.query(query)
      stream.on('end', async () => {
        if (batch.length) {
          await fillEdgesWithWeight(profileId, batch.splice(0), lastWeight)
        }
        done()

        logger.info(`profileId ${profileId} = updateEdgesWithNullWeight: done!`)
        resolve()
      })
      stream.on('error', (err) => {
        reject(err)
      })
      const fillWeights = new Writable({
        objectMode: true,
        async write(nft, _encoding, callback) {
          batch.push(nft)
          if (batch.length === batchSize) {
            lastWeight = await fillEdgesWithWeight(profileId, batch.splice(0, batchSize), lastWeight)
          }
          callback()
        },
      })
      stream.pipe(fillWeights)
    })
  })
}

export const updateEdgesWeightForProfile = async (
  profileId: string,
  walletId: string,
): Promise<void> => {
  try {
    const nftCount = repositories.nft.count({
      walletId: walletId,
      chainId: chainId,
    })
    logger.info({ nftCount, profileId, walletId }, 'updateEdgesWeightForProfile')
    if (!nftCount) return
    await updateEdgesWithNullWeight(profileId)

    // save edges for new nfts...
    logger.info(`updateEdgesWeightForProfile: saveEdgesWithWeight for profileId: ${profileId} and walletId: ${walletId}`)
    await saveEdgesWithWeight(profileId, true, { walletId })

    logger.info(`updateEdgesWeightForProfile: saveEdgesWithWeight for profileId: ${profileId} and walletId: ${walletId} done!`)
  } catch (err) {
    logger.error(`Error in updateEdgesWeightForProfile: ${err}`)
    Sentry.captureMessage(`Error in updateEdgesWeightForProfile: ${err}`)
    throw err
  }
}

const deleteExtraEdges = async (edges: entity.Edge[]): Promise<void> => {
  logger.debug(`${edges.length} edges to be synced in syncEdgesWithNFTs`)

  // Delete edges where NFT does not exist
  const disconnectedEdgeIds: string[] = (await nftLoader.loadMany(edges.map((e) => e.thatEntityId)))
    .reduce((disconnectedEdges, nft, i) => {
      if (!nft) disconnectedEdges.push(edges[i].id)
      return disconnectedEdges
    }, [])

  // Delete edges that are duplicate connections on an NFT
  const duplicatedIds = findDuplicatesByProperty(edges, 'thatEntityId').map((e) => e.id)

  const edgeIdsToDelete = [...new Set([...disconnectedEdgeIds, ...duplicatedIds])]
  if (edgeIdsToDelete.length)
    await repositories.edge.hardDeleteByIds(edgeIdsToDelete)
}
export const syncEdgesWithNFTs = async (
  profileId: string,
): Promise<void> => {
  try {
    const pgClient = db.getPgClient(true)
    await new Promise<void>((resolve, reject) => {
      pgClient.connect((err, client, done) => {
        if (err) throw err
        const batch = []
        const batchSize = 100
        const query = new QueryStream(
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
          { batchSize, highWaterMark: 500 },
        )
        const stream = client.query(query)
        stream.on('end', async () => {
          if (batch.length) {
            await deleteExtraEdges(batch.splice(0))
          }
          done()
          resolve()
        })
        stream.on('error', (err) => {
          reject(err)
        })
        const processEdges = new Writable({
          objectMode: true,
          async write(nft, _encoding, callback) {
            batch.push(nft)
            if (batch.length === batchSize) {
              await deleteExtraEdges(batch.splice(0, batchSize))
            }
            callback()
          },
        })
        stream.pipe(processEdges)
      })
    })
  } catch (err) {
    logger.error(`Error in syncEdgesWithNFTs: ${err}`)
    Sentry.captureMessage(`Error in syncEdgesWithNFTs: ${err}`)
    throw err
  }
}

export const updateNFTsForAssociatedWallet = async (
  profileId: string,
  wallet: entity.Wallet,
): Promise<void> => {
  try {
    const cacheKey = `${CacheKeys.UPDATE_NFT_FOR_ASSOCIATED_WALLET}_${wallet.chainId}_${wallet.id}_${wallet.userId}`
    const cachedData = await cache.get(cacheKey)
    if (!cachedData) {
      await checkNFTContractAddresses(
        wallet.userId,
        wallet.id,
        wallet.address,
        wallet.chainId,
      )
      await updateWalletNFTs(
        wallet.userId,
        wallet,
        wallet.chainId,
      )
      // save NFT edges for profile...
      await updateEdgesWeightForProfile(profileId, wallet.id)
      const nfts = await repositories.nft.find({
        where: {
          userId: wallet.userId,
          walletId: wallet.id,
          chainId: wallet.chainId,
        },
      })
      await cache.set(cacheKey, nfts.length.toString(), 'EX', 60 * 10)
    } else return
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
    newAddresses.map((address) => {
      seen[address] = true
    })
    prevAddresses.map((address) => {
      if (!seen[address]) toRemove.push(address)
    })
    if (!toRemove.length) return
    await Promise.allSettled(
      toRemove.map(async (address) => {
        const wallet = await repositories.wallet.findByChainAddress(
          chainId,
          ethers.utils.getAddress(address),
        )
        if (wallet) {
          const nfts = await repositories.nft.find({ where: { walletId: wallet.id } })
          if (nfts.length) {
            const toRemoveEdges = []
            await Promise.allSettled(
              nfts.map(async (nft) => {
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
            if (toRemoveEdges.length)
              await repositories.edge.hardDeleteByIds(toRemoveEdges)
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
    const cacheKey = `${CacheKeys.ASSOCIATED_ADDRESSES}_${chainId}_${profile.url}`
    const cachedData = await cache.get(cacheKey)
    let addresses: string[]
    if (cachedData) {
      addresses = JSON.parse(cachedData)
    } else {
      const nftResolverContract = typechain.NftResolver__factory.connect(
        contracts.nftResolverAddress(chainId),
        provider.provider(Number(chainId)),
      )
      const associatedAddresses = await nftResolverContract.associatedAddresses(profile.url)
      addresses = associatedAddresses.map((item) => item.chainAddr)
      logger.debug(`${addresses.length} associated addresses for profile ${profile.url}`)
      // remove NFT edges for non-associated addresses
      await removeEdgesForNonassociatedAddresses(
        profile.id,
        profile.associatedAddresses,
        addresses,
        chainId,
      )
      if (!addresses.length) {
        return `No associated addresses of ${profile.url}`
      }
      await cache.set(cacheKey, JSON.stringify(addresses), 'EX', 60 * 5)
      // update associated addresses with the latest updates
      await repositories.profile.updateOneById(profile.id, { associatedAddresses: addresses })
    }
    // save User, Wallet for associated addresses...
    const wallets: entity.Wallet[] = []
    await Promise.allSettled(
      addresses.map(async (address) => {
        wallets.push(await saveUsersForAssociatedAddress(chainId, address, repositories))
      }),
    )
    // refresh NFTs for associated addresses...
    await Promise.allSettled(
      wallets.map(async (wallet) => {
        try {
          await updateNFTsForAssociatedWallet(profile.id, wallet)
        } catch (err) {
          logger.error(`Error in updateNFTsForAssociatedAddresses: ${err}`)
          Sentry.captureMessage(`Error in updateNFTsForAssociatedAddresses: ${err}`)
        }
      }),
    )
    await syncEdgesWithNFTs(profile.id)
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
      contract = ethers.utils.getAddress(associatedContract.chainAddr)
      await cache.set(cacheKey, JSON.stringify(contract), 'EX', 60 * 5)
      // update associated contract with the latest updates
      await repositories.profile.updateOneById(profile.id, { associatedContract: contract })
    }
    // get collection info
    let collectionName = await getCollectionNameFromDataProvider(
      contract,
      chainId,
      defs.NFTType.ERC721,
    )
    if (collectionName === 'Unknown Name') {
      collectionName = await getCollectionNameFromDataProvider(
        contract,
        chainId,
        defs.NFTType.ERC1155,
      )
    }
    // check if deployer of associated contract is in associated addresses
    const deployer = await getCollectionDeployer(contract, chainId)
    if (!deployer) {
      if (profile.profileView === defs.ProfileViewType.Collection) {
        await repositories.profile.updateOneById(profile.id,
          {
            profileView: defs.ProfileViewType.Gallery,
          },
        )
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
      const checkedDeployer =  ethers.utils.getAddress(deployer)
      const isAssociated = profile.associatedAddresses.indexOf(checkedDeployer) !== -1 ||
        checkedDeployer === walletAddress
      if (!isAssociated && profile.profileView === defs.ProfileViewType.Collection) {
        await repositories.profile.updateOneById(profile.id,
          {
            profileView: defs.ProfileViewType.Gallery,
          },
        )
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
    const exists = gkOwners[checkSumOwner(wallet.address)]
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

export const saveVisibleNFTsForProfile = async (
  profileId: string,
  repositories: db.Repository,
): Promise<void> => {
  try {
    logger.info(`starting saveVisibleNFTsForProfile: ${profileId}`)
    const edges = await repositories.edge.find({
      where: {
        thisEntityId: profileId,
        thisEntityType: defs.EntityType.Profile,
        thatEntityType: defs.EntityType.NFT,
        edgeType: defs.EdgeType.Displays,
        hide: false,
      },
    })
    if (edges.length) {
      await repositories.profile.updateOneById(profileId, { visibleNFTs: edges.length })
      logger.info(`saveVisibleNFTsForProfile: ${profileId} - ${edges.length} visible NFTs`)
    } else {
      logger.info(`saveVisibleNFTsForProfile: ${profileId} - no visible NFTs`)
    }
  } catch (err) {
    logger.error(`Error in saveVisibleNFTsForProfile: ${err}`)
    Sentry.captureMessage(`Error in saveVisibleNFTsForProfile: ${err}`)
    throw err
  }
}

export const saveProfileScore = async (
  repositories: db.Repository,
  profile: entity.Profile,
): Promise<void> => {
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
      const collections = [...new Set(nfts.map((nft) => nft.contract))]
      
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
  
      const paddedGK =  gkNFTs.length.toString().padStart(5, '0')
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

export const getCollectionInfo = async (
  contract: string,
  chainId: string,
  repositories: db.Repository,
): Promise<any> => {
  try {
    const key = `${contract.toLowerCase()}-${chainId}`
    const cachedData = await cache.get(key)

    if (cachedData) {
      return JSON.parse(cachedData)
    } else {
      let collection = await repositories.collection.findByContractAddress(
        ethers.utils.getAddress(contract),
        chainId,
      )
      let nftPortResults = undefined

      if (!collection) {
        return {
          collection,
          nftPortResults,
        }
      }

      if (collection && (
        collection.deployer == null ||
        ethers.utils.getAddress(collection.deployer) !== collection.deployer
      )) {
        const collectionDeployer = await getCollectionDeployer(contract, chainId)
        collection = await repositories.collection.save({
          ...collection,
          deployer: collectionDeployer,
        })
        // await seService.indexCollections([collection])
      }

      const nft = await repositories.nft.findOne({
        where: {
          contract: ethers.utils.getAddress(contract),
          chainId,
        },
      })

      if (!nft) {
        return {
          collection,
          nftPortResults,
        }
      }

      let bannerUrl = 'https://cdn.nft.com/collectionBanner_default.png'
      let logoUrl = 'https://cdn.nft.com/profile-image-default.svg'
      let description = null
      const uploadPath = `collections/${chainId}/`

      // check if logoUrl, bannerUrl, description are null or default -> if not, return, else, proceed
      const notAllowedToProceed: boolean = !!collection.bannerUrl
        && !exceptionBannerUrlRegex.test(collection.bannerUrl)
        && !!collection.logoUrl
        && collection.logoUrl !== logoUrl
        && !!collection.description

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
          if (details.contract.metadata?.cached_thumbnail_url &&
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
            description = details.contract.metadata?.description?.length ?
              details.contract.metadata.description : description
          }
        }
        const updatedCollection = await repositories.collection.updateOneById(collection.id, {
          bannerUrl,
          logoUrl,
          description,
        })
        await seService.indexCollections([updatedCollection])
        collection = await repositories.collection.findByContractAddress(
          ethers.utils.getAddress(contract),
          chainId,
        )
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
          collection = await repositories.collection.findByContractAddress(
            ethers.utils.getAddress(contract),
            chainId,
          )
        }
      }

      const returnObject = {
        collection,
        nftPortResults,
      }

      await cache.set(key, JSON.stringify(returnObject), 'EX', 60 * (5))
      return returnObject
    }
  } catch (err) {
    logger.error(`Error in getCollectionInfo: ${err}`)
    Sentry.captureMessage(`Error in getCollectionInfo: ${err}`)
    throw err
  }
}

export const updateNFTMetadata = async (
  nft: entity.NFT,
  repositories: db.Repository,
): Promise<void> => {
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
        const csOwner = checkSumOwner(owners[0])
        const fallbackWallet = new entity.Wallet()
        fallbackWallet.address = csOwner
        return await repositories.wallet.findByChainAddress(chainId, csOwner) || fallbackWallet
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
    const csOwner = checkSumOwner(wallet.address)
    const savedNFT = await repositories.nft.save({
      chainId: chainId,
      userId: wallet.userId,
      walletId: wallet.id,
      owner: csOwner,
      contract: ethers.utils.getAddress(contract),
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
      const matchingMakeAsset = order.protocolData.makeAsset.find((asset) => {
        return asset?.standard?.contractAddress &&
          helper.checkSum(asset?.standard?.contractAddress) === helper.checkSum(contract) &&
          BigNumber.from(asset?.standard?.tokenId).eq(BigNumber.from(tokenId))
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
export const getNFTActivities = <T>(
  activityType: defs.ActivityType,
) => {
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
          'first': 50,
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
        } else if (expirationType === gql.ActivityExpiration.Expired){
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
        )
          .then(pagination.toPageable(pageInput, null, null, 'createdAt'))
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

  const edges = onlyVisible ? await repositories.edge.find({
    where: { ...whereQuery, hide: false },
  }) : await repositories.edge.find({ where: whereQuery })
  const nfts: entity.NFT[] = []
  await Promise.allSettled(
    edges.map(async (edge) => {
      const nft = await repositories.nft.findById(edge.thatEntityId)
      if (nft && nft.metadata.name && nft.metadata.name.toLowerCase().includes(query.toLowerCase())) {
        nfts.push(nft)
      }
    }),
  )
  return nfts
}

// no cache to have instant updates
export const profileOwner = async (
  profileUrl: string,
  chainId: string,
): Promise<string | undefined> => {
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

export const profileGKNFT = async (
  contract: string,
  tokenId: string,
  chainId: string,
): Promise<boolean> => {
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
    await cache.zadd(`${CacheKeys.PROFILE_GK_NFT}_${chainId}`, score,  numericTokenId)
  }

  return !!profile.isGKMinted
}