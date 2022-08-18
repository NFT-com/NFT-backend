import axios from 'axios'
import { BigNumber, ethers } from 'ethers'
import * as Lodash from 'lodash'
import fetch from 'node-fetch'
import * as typeorm from 'typeorm'

import { AlchemyWeb3, createAlchemyWeb3 } from '@alch/alchemy-web3'
import { Upload } from '@aws-sdk/lib-storage'
import { assetBucket, getChain } from '@nftcom/gql/config'
import { getCollectionDeployer } from '@nftcom/gql/service/alchemy.service'
import { cache, CacheKeys } from '@nftcom/gql/service/cache.service'
import {
  contentTypeFromExt,
  extensionFromFilename,
  generateWeight,
  getAWSConfig,
  getLastWeight,
  midWeight, s3ToCdn,
} from '@nftcom/gql/service/core.service'
import { getUbiquity } from '@nftcom/gql/service/ubiquity.service'
import { _logger, contracts, db, defs, entity, provider, typechain } from '@nftcom/shared'
import * as Sentry from '@sentry/node'

import { SearchEngineService } from '../service/searchEngine.service'

const repositories = db.newRepositories()
const logger = _logger.Factory(_logger.Context.Misc, _logger.Context.GraphQL)
const seService = new SearchEngineService()

const ALCHEMY_API_URL = process.env.ALCHEMY_API_URL
const ALCHEMY_API_URL_RINKEBY = process.env.ALCHEMY_API_URL_RINKEBY
const ALCHEMY_API_URL_GOERLI = process.env.ALCHEMY_API_URL_GOERLI
const MAX_SAVE_COUNTS = 500
let web3: AlchemyWeb3
let alchemyUrl: string

interface OwnedNFT {
  contract: {
    address: string
  }
  id: {
    tokenId: string
  }
}

interface ContractMetaDataResponse {
  address: string
  contractMetadata: {
    name: string
    symbol: string
    totalSupply: string
    tokenType: string
  }
}

interface NFTMetaDataResponse {
  contract: {
    address: string
  }
  id: {
    tokenId: string
    tokenMetadata: {
      tokenType: string
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

export const initiateWeb3 = (chainId?: string): void => {
  chainId = chainId || process.env.CHAIN_ID // attach default value
  const alchemy_api_url = chainId === '1' ? ALCHEMY_API_URL :
    (chainId === '5' ? ALCHEMY_API_URL_GOERLI : ALCHEMY_API_URL_RINKEBY)
  web3 = createAlchemyWeb3(alchemy_api_url)
  alchemyUrl = Number(chainId) == 1 ? process.env.ALCHEMY_API_URL :
    Number(chainId) == 5 ? process.env.ALCHEMY_API_URL_GOERLI :
      Number(chainId) == 4 ? process.env.ALCHEMY_API_URL_RINKEBY : ''
}

export const getNFTsFromAlchemy = async (
  owner: string,
  contracts?: string[],
): Promise<OwnedNFT[]> => {
  try {
    let pageKey
    const ownedNFTs: Array<OwnedNFT> = []
    let response
    if (contracts) {
      response = await web3.alchemy.getNfts({
        owner: owner,
        withMetadata: false,
        contractAddresses: contracts,
      })
    } else {
      response = await web3.alchemy.getNfts({
        owner: owner,
        withMetadata: false,
      })
    }

    if (response.ownedNfts) {
      ownedNFTs.push(...response.ownedNfts as OwnedNFT[])
      if (response.pageKey) {
        pageKey = response.pageKey
        // eslint-disable-next-line no-constant-condition
        while (true) {
          let res
          if (contracts) {
            res = await web3.alchemy.getNfts({
              owner: owner,
              withMetadata: false,
              pageKey: pageKey,
              contractAddresses: contracts,
            })
          } else {
            res = await web3.alchemy.getNfts({
              owner: owner,
              withMetadata: false,
              pageKey: pageKey,
            })
          }
          if (res.ownedNfts) {
            ownedNFTs.push(...res.ownedNfts as OwnedNFT[])
            if (res.pageKey) {
              pageKey = res.pageKey
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
    Sentry.captureMessage(`Error in getNFTsFromAlchemy: ${err}`)
    return []
  }
}

/**
 * Takes a bunch of NFTs (pulled from the DB), and checks
 * that the given owner is still correct.
 *
 * If not, deletes the NFT record from the DB.
 */
const filterNFTsWithAlchemy = async (
  nfts: Array<typeorm.DeepPartial<entity.NFT>>,
  owner: string,
): Promise<any[]> => {
  const contracts = []
  nfts.forEach((nft: typeorm.DeepPartial<entity.NFT>) => {
    contracts.push(nft.contract)
  })
  try {
    const ownedNfts = await getNFTsFromAlchemy(owner, contracts)
    const checksum = ethers.utils.getAddress

    return await Promise.allSettled(
      nfts.map(async (dbNFT: typeorm.DeepPartial<entity.NFT>) => {
        const index = ownedNfts.findIndex((ownedNFT: OwnedNFT) =>
          checksum(ownedNFT.contract.address) === checksum(dbNFT.contract) &&
          BigNumber.from(ownedNFT?.id?.tokenId).eq(BigNumber.from(dbNFT.tokenId)),
        )
        // We didn't find this NFT entry in the most recent list of
        // this user's owned tokens for this contract/collection.
        if (index === -1) {
          await repositories.edge.hardDelete({ thatEntityId: dbNFT.id } )
            .then(() => repositories.nft.hardDelete({
              id: dbNFT.id,
            }))
        }
      }),
    )
  } catch (err) {
    Sentry.captureMessage(`Error in filterNFTsWithAlchemy: ${err}`)
    return []
  }
}

const getNFTMetaDataFromAlchemy = async (
  contractAddress: string,
  tokenId: string,
): Promise<NFTMetaDataResponse | undefined> => {
  try {
    const response = await web3.alchemy.getNftMetadata({
      contractAddress: contractAddress,
      tokenId: tokenId,
    })

    return response as NFTMetaDataResponse
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

      if (response.data) {
        await cache.set(key, JSON.stringify(response.data), 'EX', 60 * 60) // 1 hour
      }
      return response.data
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
    const network = getChain('ethereum', chainId)
    if (type === defs.NFTType.ERC721) {
      const tokenContract = typechain.ERC721__factory.connect(
        contractAddress,
        provider.provider(network.name),
      )
      return tokenContract.name().catch(() => Promise.resolve('Unknown Name'))
    } else if (type === defs.NFTType.ERC1155 || type === defs.NFTType.UNKNOWN) {
      const tokenContract = typechain.ERC1155__factory.connect(
        contractAddress,
        provider.provider(network.name),
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

const updateCollectionForNFTs = async (
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
          const collectionName = await getCollectionNameFromContract(
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

const getNFTMetaData = async (
  contract: string,
  tokenId: string,
): Promise<NFTMetaData | undefined> => {
  try {
    let type: defs.NFTType
    const traits: Array<defs.Trait> = []

    const nftMetadata: NFTMetaDataResponse = await getNFTMetaDataFromAlchemy(
      contract,
      tokenId,
    )

    if (!nftMetadata) return

    const contractMetadata: ContractMetaDataResponse =
      await getContractMetaDataFromAlchemy(contract)

    const name = nftMetadata?.title || `${contractMetadata.contractMetadata.name} #${Number(tokenId).toString()}`
    const description = nftMetadata?.description
    const image = nftMetadata?.metadata?.image
    if (nftMetadata?.id?.tokenMetadata.tokenType === 'ERC721') {
      type = defs.NFTType.ERC721
    } else if (nftMetadata?.id?.tokenMetadata?.tokenType === 'ERC1155') {
      type = defs.NFTType.ERC1155
    } else if (nftMetadata?.title.endsWith('.eth')) { // if token is ENS token...
      type = defs.NFTType.UNKNOWN
    }

    if (Array.isArray(nftMetadata?.metadata?.attributes)) {
      nftMetadata?.metadata?.attributes.map((trait) => {
        traits.push(({
          type: trait?.trait_type,
          value: trait?.value,
        }))
      })
    } else {
      if (nftMetadata?.metadata?.attributes) {
        Object.keys(nftMetadata?.metadata?.attributes).map(keys => {
          traits.push(({
            type: keys,
            value: nftMetadata?.metadata?.attributes?.[keys],
          }))
        })
      }
    }

    return {
      type,
      name,
      description,
      image,
      traits,
    }
  } catch (err) {
    Sentry.captureMessage(`Error in getNFTMetaData: ${err}`)
    return err
  }
}

const updateNFTOwnershipAndMetadata = async (
  nft: OwnedNFT,
  userId: string,
  walletId: string,
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

    let walletChainId: string = await cache.get(`chainId_${walletId}`)

    if (!walletChainId) {
      const wallet = await repositories.wallet.findById(walletId)
      await cache.set(`chainId_${walletId}`, wallet.chainId)
      walletChainId = wallet.chainId
    }

    const metadata = await getNFTMetaData(nft.contract.address, nft.id.tokenId)
    if (!metadata) return undefined

    const { type, name, description, image, traits } = metadata
    // if this NFT is not existing on our db, we save it...
    if (!existingNFT) {
      const savedNFT = await repositories.nft.save({
        chainId: walletChainId || process.env.CHAIN_ID,
        userId,
        walletId,
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
      await seService.indexNFT(savedNFT)
      return savedNFT
    } else {
      // if this NFT is existing and owner changed, we change its ownership...
      if (existingNFT.userId !== userId || existingNFT.walletId !== walletId) {
        // if this NFT is a profile NFT...
        if (existingNFT.contract === contracts.nftProfileAddress(chainId)) {
          const previousWallet = await repositories.wallet.findById(existingNFT.walletId)
          const profile = await repositories.profile.findOne({ where: {
            tokenId: BigNumber.from(existingNFT.tokenId).toString(),
            walletId: previousWallet.id,
            userId: previousWallet.userId,
          } })
          // if this NFT was previous owner's preferred profile...
          if (profile.id === previousWallet.profileId) {
            await repositories.wallet.updateOneById(previousWallet.id, {
              profileId: null,
            })
          }
        }
        return await repositories.nft.updateOneById(existingNFT.id, {
          userId,
          walletId,
          type,
          profileId: null,
          metadata: {
            name,
            description,
            imageURL: image,
            traits: traits,
          },
        })
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
          return await repositories.nft.updateOneById(existingNFT.id, {
            userId,
            walletId,
            type,
            metadata: {
              name,
              description,
              imageURL: image,
              traits: traits,
            },
          })
        } else {
          logger.debug('No need to update owner and metadata', existingNFT.contract)
          return undefined
        }
      }
    }
  } catch (err) {
    Sentry.captureMessage(`Error in updateNFTOwnershipAndMetadata: ${err}`)
    return undefined
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
): Promise<void[]> => {
  try {
    const nfts = await repositories.nft.find({ where: {
      userId: userId,
      walletId: walletId,
      chainId: chainId,
    } })
    if (!nfts.length) {
      return []
    }
    const nftsChunks: entity.NFT[][] = Lodash.chunk(
      nfts,
      20,
    )
    await Promise.allSettled(
      nftsChunks.map(async (nftChunk: entity.NFT[]) => {
        await filterNFTsWithAlchemy(nftChunk, walletAddress)
      }),
    )
  } catch (err) {
    Sentry.captureMessage(`Error in checkNFTContractAddresses: ${err}`)
    return []
  }
}

/**
 * update wallet NFTs using data from alchemy api
 * @param userId
 * @param walletId
 * @param walletAddress
 * @param chainId
 */
export const updateWalletNFTs = async (
  userId: string,
  walletId: string,
  walletAddress: string,
  chainId: string,
): Promise<void> => {
  const ownedNFTs = await getNFTsFromAlchemy(walletAddress)
  const savedNFTs: entity.NFT[] = []
  await Promise.allSettled(
    ownedNFTs.map(async (nft: OwnedNFT) => {
      const savedNFT = await updateNFTOwnershipAndMetadata(nft, userId, walletId, chainId)
      if (savedNFT) savedNFTs.push(savedNFT)
    }),
  )
  await updateCollectionForNFTs(savedNFTs)
}

export const refreshNFTMetadata = async (
  nft: entity.NFT,
): Promise<entity.NFT> => {
  try {
    // hard refresh for now
    // until Alchemy SDK incorporates this
    // TODO: remove in future
    const alchemy_api_url = nft.chainId === '1' ? process.env.ALCHEMY_API_URL :
      (nft.chainId === '5' ? process.env.ALCHEMY_API_URL_GOERLI : process.env.ALCHEMY_API_URL_RINKEBY)
    await axios.get(`${alchemy_api_url}/getNFTMetadata?contractAddress=${nft.contract}&tokenId=${BigNumber.from(nft.tokenId).toString()}&tokenType=${nft.type == defs.NFTType.ERC1155 ? 'erc1155' : 'erc721'}&refreshCache=true`)

    const metadata = await getNFTMetaData(
      nft.contract,
      BigNumber.from(nft.tokenId).toString(),
    )
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
    Sentry.captureMessage(`Error in refreshNFTMetadata: ${err}`)
    return err
  }
}

export const getOwnersOfGenesisKeys = async (
  chainId: string,
): Promise<string[]> => {
  const contract = contracts.genesisKeyAddress(chainId)
  if (chainId !== '1' && chainId !== '5') return []
  try {
    const key = `${CacheKeys.GENESIS_KEY_OWNERS}_${chainId}`
    const cachedData = await cache.get(key)
    if (cachedData) {
      return JSON.parse(cachedData) as string[]
    }
    // until Alchemy SDK incorporates this
    // TODO: remove in future
    const alchemy_api_url = chainId === '1' ? process.env.ALCHEMY_API_URL : process.env.ALCHEMY_API_URL_GOERLI
    const res = await axios.get(`${alchemy_api_url}/getOwnersForCollection?contractAddress=${contract}`)
    if (res && res.data && res.data.ownerAddresses) {
      const gkOwners = res.data.ownerAddresses as string[]
      await cache.set(key, JSON.stringify(gkOwners), 'EX', 60)
      return gkOwners
    } else {
      return []
    }
  } catch (err) {
    Sentry.captureMessage(`Error in getOwnersOfGenesisKeys: ${err}`)
    return []
  }
}

const hideAllNFTs = async (
  repositories: db.Repository,
  profileId: string,
): Promise<void> => {
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
}
const saveEdgesWithWeight = async (
  nfts: entity.NFT[],
  profileId: string,
  hide: boolean,
): Promise<void> => {
  try {
    const nftsToBeAdded = []
    const edgesWithWeight = []
    // filter nfts are not added to edge yet...
    await Promise.allSettled(
      nfts.map(async (nft: entity.NFT) => {
        const displayEdge = await repositories.edge.findOne({
          where: {
            thisEntityType: defs.EntityType.Profile,
            thatEntityType: defs.EntityType.NFT,
            thisEntityId: profileId,
            thatEntityId: nft.id,
            edgeType: defs.EdgeType.Displays,
          },
        })
        if (!displayEdge) nftsToBeAdded.push(nft)
      }),
    )
    // generate weights for nfts...
    let weight = await getLastWeight(repositories, profileId)
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
    // save nfts to edge...
    await repositories.edge.saveMany(edgesWithWeight, { chunk: MAX_SAVE_COUNTS })
  } catch (err) {
    Sentry.captureMessage(`Error in saveEdgesWithWeight: ${err}`)
    return err
  }
}

const showAllNFTs = async (
  repositories: db.Repository,
  walletId: string,
  profileId: string,
  chainId: string,
): Promise<void> => {
  const nfts = await repositories.nft.find({ where: { walletId, chainId } })
  if (nfts.length) {
    await saveEdgesWithWeight(nfts, profileId, false)
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
}

const showNFTs = async (
  showNFTIds: string[],
  profileId: string,
  chainId: string,
): Promise<void> => {
  const nfts = []
  await Promise.allSettled(
    showNFTIds.map(async (id) => {
      const existingNFT = await repositories.nft.findOne({ where: { id, chainId } })
      if (existingNFT) nfts.push(existingNFT)
    }),
  )
  if (nfts.length) {
    await saveEdgesWithWeight(nfts, profileId, false)
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
      return
    } else if (hideAll) {
      await hideAllNFTs(repositories, profileId)
      return
    } else {
      if (showNFTIds?.length) {
        await showNFTs(showNFTIds, profileId, chainId)
      }
      if (hideNFTIds) {
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
      }
    }
  } catch (err) {
    Sentry.captureMessage(`Error in changeNFTsVisibility: ${err}`)
    return err
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
        },
        order: {
          weight: 'ASC',
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
  } catch (err) {
    Sentry.captureMessage(`Error in updateNFTsOrder: ${err}`)
    return err
  }
}

export const updateEdgesWeightForProfile = async (
  profileId: string,
  walletId: string,
): Promise<void> => {
  try {
    const nfts = await repositories.nft.find({ where: { walletId } })
    if (!nfts.length) return
    const nullEdges = await repositories.edge.find({
      where: {
        thisEntityType: defs.EntityType.Profile,
        thatEntityType: defs.EntityType.NFT,
        thisEntityId: profileId,
        edgeType: defs.EdgeType.Displays,
        weight: null,
      },
    })
    if (nullEdges.length) {
      // fill weight of edges which have null as weight...
      let weight = await getLastWeight(repositories, profileId)
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
      await repositories.edge.saveMany(edgesWithWeight, { chunk: MAX_SAVE_COUNTS })
    }
    // save edges for new nfts...
    await saveEdgesWithWeight(nfts, profileId, true)
  } catch (err) {
    Sentry.captureMessage(`Error in updateEdgesWeightForProfile: ${err}`)
    return err
  }
}

export const syncEdgesWithNFTs = async (
  profileId: string,
): Promise<void> => {
  try {
    const seen = {}
    const edges = await repositories.edge.find({
      where: {
        thisEntityType: defs.EntityType.Profile,
        thatEntityType: defs.EntityType.NFT,
        thisEntityId: profileId,
        edgeType: defs.EdgeType.Displays,
      },
    })

    logger.debug(`${edges.length} edges to be synced in syncEdgesWithNFTs`)

    const duplicatedIds: Array<string> = []
    await Promise.allSettled(
      edges.map(async (edge) => {
        // check duplicates in edges
        const key = [
          edge.thisEntityId,
          edge.thatEntityId,
          edge.edgeType,
          edge.thisEntityType,
          edge.thatEntityType,
        ].join('-')

        if (seen[key]) {
          duplicatedIds.push(edge.id)
        } else {
          seen[key] = true
        }

        const nft = await repositories.nft.findOne({ where: { id: edge.thatEntityId } })
        if (!nft) {
          await repositories.edge.hardDelete({ id: edge.id })
        }
      }),
    )
    await repositories.edge.hardDeleteByIds(duplicatedIds)
  } catch (err) {
    Sentry.captureMessage(`Error in syncEdgesWithNFTs: ${err}`)
    return err
  }
}

export const updateNFTsForAssociatedWallet = async (
  profileId: string,
  wallet: entity.Wallet,
): Promise<void> => {
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
      wallet.id,
      wallet.address,
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
}

export const removeEdgesForNonassociatedAddresses = async (
  profileId: string,
  prevAddresses: string[],
  newAddresses: string[],
  chainId: string,
): Promise<void> => {
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
}

export const downloadImageFromUbiquity = async (
  url: string,
): Promise<Buffer | undefined> => {
  try {
    const res = await fetch(url + `?apiKey=${process.env.UBIQUITY_API_KEY}`)
    return await res.buffer()
  } catch (err) {
    Sentry.captureMessage(`Error in downloadImageFromUbiquity: ${err}`)
    return undefined
  }
}

const downloadAndUploadImageToS3 = async (
  chainId: string,
  url: string,
  fileName: string,
): Promise<string | undefined> => {
  try {
    const ext = extensionFromFilename(url)
    const fullName = ext ? fileName + '.' + ext : fileName
    const imageKey = `collections/${chainId}/` + Date.now() + '-' + fullName
    const contentType = contentTypeFromExt(ext)
    if (!contentType) return undefined
    const buffer = await downloadImageFromUbiquity(url)
    if (buffer) {
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

      return s3ToCdn(`https://${assetBucket.name}.s3.amazonaws.com/${imageKey}`)
    } else return undefined
  } catch (err) {
    Sentry.captureMessage(`Error in downloadAndUploadImageToS3: ${err}`)
    return undefined
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
        contract,
        chainId,
      )

      if (collection && (
        collection.deployer == null ||
        ethers.utils.getAddress(collection.deployer) !== collection.deployer
      )) {
        const collectionDeployer = await getCollectionDeployer(contract, chainId)
        await repositories.collection.save({
          ...collection,
          deployer: collectionDeployer,
        })
        collection.deployer = collectionDeployer
      }

      let bannerUrl = 'https://cdn.nft.com/profile-banner-default-logo-key.png'
      let logoUrl = 'https://cdn.nft.com/profile-image-default.svg'
      let description = 'placeholder collection description text'
      const ubiquityFolder = 'https://ubiquity.api.blockdaemon.com/v1/nft/media/ethereum/mainnet/'
      let ubiquityResults = undefined
      if (chainId === '1') {
        // check if banner or logo url we saved are incorrect images
        let bannerExt
        let bannerContentType
        let logoExt
        let logoContentType
        if (collection.bannerUrl) {
          bannerExt = extensionFromFilename(collection.bannerUrl)
          bannerContentType = contentTypeFromExt(bannerExt)
        }
        if (collection.logoUrl) {
          logoExt = extensionFromFilename(collection.logoUrl)
          logoContentType = contentTypeFromExt(logoExt)
        }
        // we won't call Ubiquity api so often because we have a limited number of calls to Ubiquity
        if (!collection.bannerUrl || !collection.logoUrl || !collection.description
          || !bannerContentType || !logoContentType
        ) {
          ubiquityResults = await getUbiquity(contract, chainId)
          if (ubiquityResults) {
            // check if banner url from Ubiquity is correct one
            if (ubiquityResults.collection.banner !== ubiquityFolder) {
              const banner = await downloadAndUploadImageToS3(
                chainId,
                ubiquityResults.collection.banner,
                'banner',
              )
              bannerUrl = banner ? banner : bannerUrl
            }
            // check if logo url from Ubiquity is correct one
            if (ubiquityResults.collection.logo !== ubiquityFolder) {
              const logo = await downloadAndUploadImageToS3(
                chainId,
                ubiquityResults.collection.logo,
                'logo',
              )
              logoUrl = logo ? logo : logoUrl
            }

            description = ubiquityResults.collection.description.length ?
              ubiquityResults.collection.description : description
          }
          await repositories.collection.updateOneById(collection.id, {
            bannerUrl,
            logoUrl,
            description,
          })
          collection = await repositories.collection.findByContractAddress(
            contract,
            chainId,
          )
        }
      } else {
        if (!collection.bannerUrl || !collection.logoUrl || !collection.description) {
          await repositories.collection.updateOneById(collection.id, {
            bannerUrl,
            logoUrl,
            description,
          })
          collection = await repositories.collection.findByContractAddress(
            contract,
            chainId,
          )
        }
      }

      const returnObject = {
        collection,
        ubiquityResults,
      }

      await cache.set(key, JSON.stringify(returnObject), 'EX', 60 * (5))
      return returnObject
    }
  } catch (err) {
    Sentry.captureMessage(`Error in getCollectionInfo: ${err}`)
    return err
  }
}
