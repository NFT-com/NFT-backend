import axios from 'axios'
import { BigNumber, ethers } from 'ethers'
import * as Lodash from 'lodash'
import * as typeorm from 'typeorm'

//import Typesense from 'typesense'
import { AlchemyWeb3, createAlchemyWeb3 } from '@alch/alchemy-web3'
import { getChain } from '@nftcom/gql/config'
import { getCollectionDeployer } from '@nftcom/gql/service/alchemy.service'
import { cache, CacheKeys } from '@nftcom/gql/service/cache.service'
import { generateWeight, getLastWeight, midWeight } from '@nftcom/gql/service/core.service'
import { _logger, contracts, db, defs, entity, provider, typechain } from '@nftcom/shared'
import * as Sentry from '@sentry/node'

const repositories = db.newRepositories()
const logger = _logger.Factory(_logger.Context.Misc, _logger.Context.GraphQL)

const ALCHEMY_API_URL = process.env.ALCHEMY_API_URL
const ALCHEMY_API_URL_RINKEBY = process.env.ALCHEMY_API_URL_RINKEBY
const ALCHEMY_API_URL_GOERLI = process.env.ALCHEMY_API_URL_GOERLI
const MAX_SAVE_COUNTS = 500
let web3: AlchemyWeb3
let alchemyApiKey: string

// TYPESENSE CONFIG - UNCOMMENT WHEN READY TO DEPLOY
// const TYPESENSE_HOST = process.env.TYPESENSE_HOST
// const TYPESENSE_API_KEY = process.env.TYPESENSE_API_KEY

// const client = new Typesense.Client({
//   'nodes': [{
//     'host': TYPESENSE_HOST,
//     'port': 443,
//     'protocol': 'https',
//   }],
//   'apiKey': TYPESENSE_API_KEY,
//   'connectionTimeoutSeconds': 10,
// })

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

type NFTWithWeight = {
  nft: entity.NFT
  weight: string
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
  alchemyApiKey = Number(chainId) == 1 ? (process.env.ALCHEMY_API_URL).replace('https://eth-mainnet.alchemyapi.io/v2/', '') :
    Number(chainId) == 5 ? (process.env.ALCHEMY_API_URL_GOERLI).replace('https://eth-goerli.g.alchemy.com/v2/', '') : (process.env.ALCHEMY_API_URL_RINKEBY).replace('https://eth-rinkeby.alchemyapi.io/v2/', '')
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
    const key = `getContractMetaDataFromAlchemy${alchemyApiKey}_${ethers.utils.getAddress(contractAddress)}`
    const cachedContractMetadata: string = await cache.get(key)
    
    if (cachedContractMetadata) {
      return JSON.parse(cachedContractMetadata)
    } else {
      const baseUrl = `https://eth-mainnet.g.alchemy.com/nft/v2/${alchemyApiKey}/getContractMetadata/?contractAddress=${contractAddress}`
      const response = await axios.get(baseUrl)

      await cache.set(key, JSON.stringify(response.data), 'EX', 60 * 60) // 1 hour
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

const updateCollection = async (
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

          await repositories.collection.save({
            contract: ethers.utils.getAddress(nft.contract),
            chainId: nft?.chainId || process.env.CHAIN_ID,
            name: collectionName,
            deployer: collectionDeployer,
          })
        }

        // TYPESENSE CODE COMMENTED OUT UNTIL ROLLOUT SEARCH FUNCIONALITY
        // save collection in typesense search  if new
        // if (newCollection) {
        //   const indexCollection = []
        //   indexCollection.push({
        //     id: collection.id,
        //     contract: collection.contract,
        //     name: collection.name,
        //     createdAt: collection.createdAt,
        //   })
        //   client.collections('collections').documents().import(indexCollection, { action: 'create' })
        //     .then(() => logger.debug('collection added to typesense index'))
        //     .catch(() => logger.info('error: could not save collection in typesense: '))
        // }

        // add new nft to search (Typesense)
        // if(newNFT && !existingNFT) {
        //   const indexNft = []
        //   indexNft.push({
        //     id: newNFT.id,
        //     contract: nftInfo.contract.address,
        //     tokenId: BigNumber.from(nftInfo.id.tokenId).toString(),
        //     imageURL: newNFT.metadata.imageURL ? newNFT.metadata.imageURL : '',
        //     contractName: collection.name ? collection.name : '',
        //     type: type,
        //     name: nftInfo.title,
        //     description: newNFT.metadata.description,
        //     createdAt: newNFT.createdAt,
        //   })

        //   client.collections('nfts').documents().import(indexNft, { action: 'create' })
        //     .then(() => logger.debug('nft added to typesense index'))
        //     .catch((err) => logger.info('error: could not save nft in typesense: ' + err))
        // }
      }),
    )

    // save edges for collection and nfts...
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
          if (!edge) await repositories.edge.save(edgeVals)
        }
      }),
    )
  } catch (err) {
    Sentry.captureMessage(`Error in updateCollection: ${err}`)
  }
}

const getNFTMetaData = async (
  contract: string,
  tokenId: string,
): Promise<NFTMetaData> => {
  try {
    let type: defs.NFTType
    const traits: Array<defs.Trait> = []

    const nftMetadata: NFTMetaDataResponse = await getNFTMetaDataFromAlchemy(
      contract,
      tokenId,
    )

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
      } else if (nftMetadata?.metadata) {
        Object.keys(nftMetadata?.metadata).map(keys => {
          traits.push(({
            type: keys,
            value: nftMetadata?.metadata?.[keys],
          }))
        })
      } else {
        throw Error(`nftMetadata?.metadata doesn't conform ${JSON.stringify(nftMetadata?.metadata, null, 2)}`)
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
  }
}

const updateNFTOwnershipAndMetadata = async (
  nft: OwnedNFT,
  userId: string,
  walletId: string,
  chainId: string,
): Promise<entity.NFT| undefined> => {
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
    const { type, name, description, image, traits } = metadata
    // if this NFT is not existing on our db, we save it...
    if (!existingNFT) {
      return await repositories.nft.save({
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
    } else {
      // if this NFT is existing and owner changed, we change its ownership...
      if (existingNFT.userId !== userId || existingNFT.walletId !== walletId) {
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
  await updateCollection(savedNFTs)
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
  const nftsToBeAdded = []
  const nftsWithWeight = []
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
    nftsWithWeight.push({
      nft: nftsToBeAdded[i],
      weight: newWeight,
    })
    weight = newWeight
  }
  // save nfts to edge...
  await Promise.allSettled(
    nftsWithWeight.map(async (nftWithWeight: NFTWithWeight) => {
      await repositories.edge.save({
        thisEntityType: defs.EntityType.Profile,
        thatEntityType: defs.EntityType.NFT,
        thisEntityId: profileId,
        thatEntityId: nftWithWeight.nft.id,
        edgeType: defs.EdgeType.Displays,
        weight: nftWithWeight.weight,
        hide: hide,
      })
    }),
  )
}

const showAllNFTs = async (
  repositories: db.Repository,
  userId: string,
  profileId: string,
  chainId: string,
): Promise<void> => {
  const nfts = await repositories.nft.find({ where: { userId, chainId } })
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
 * @param userId
 * @param profileId
 * @param showAll
 * @param hideAll
 * @param showNFTIds - set the NFTs' visibility as show, without regard to the previous value
 * @param hideNFTIds - set the NFTs' visibility as hide, without regard to the previous value
 * @param chainId
 */
export const changeNFTsVisibility = async (
  repositories: db.Repository,
  userId: string,
  profileId: string,
  showAll: boolean,
  hideAll: boolean,
  showNFTIds: Array<string> | null,
  hideNFTIds: Array<string> | null,
  chainId: string,
): Promise<void> => {
  try {
    if (showAll) {
      await showAllNFTs(repositories, userId, profileId, chainId)
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
  }
}

export const updateEdgesWeightForProfile = async (
  profileId: string,
  userId: string,
): Promise<void> => {
  try {
    const nfts = await repositories.nft.find({ where: { userId } })
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
    await updateEdgesWeightForProfile(profileId, wallet.userId)
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
      const user = await repositories.user.findOne({
        where: {
          username: 'ethereum-' + ethers.utils.getAddress(address),
        },
      })
      if (user) {
        const nfts = await repositories.nft.find({ where: { userId: user.id } })
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
