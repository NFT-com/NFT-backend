import axios from 'axios'
import { BigNumber, ethers } from 'ethers'
import * as Lodash from 'lodash'
import fetch from 'node-fetch'
import * as typeorm from 'typeorm'

import { AlchemyWeb3, createAlchemyWeb3 } from '@alch/alchemy-web3'
import { Upload } from '@aws-sdk/lib-storage'
import { assetBucket } from '@nftcom/gql/config'
import { gql, Pageable } from '@nftcom/gql/defs'
import { Context } from '@nftcom/gql/defs'
import { pagination } from '@nftcom/gql/helper'
import { getCollectionDeployer } from '@nftcom/gql/service/alchemy.service'
import { cache, CacheKeys } from '@nftcom/gql/service/cache.service'
import {
  contentTypeFromExt,
  extensionFromFilename,
  fetchWithTimeout, generateSVGFromBase64String,
  generateWeight,
  getAWSConfig,
  getLastWeight,
  midWeight,
  processIPFSURL,
  s3ToCdn,
  saveUsersForAssociatedAddress,
} from '@nftcom/gql/service/core.service'
import { retrieveNFTDetailsNFTPort } from '@nftcom/gql/service/nftport.service'
import { SearchEngineService } from '@nftcom/gql/service/searchEngine.service'
import { paginatedActivitiesBy } from '@nftcom/gql/service/txActivity.service'
import { _logger, contracts, db, defs, entity, helper, provider, typechain } from '@nftcom/shared'
import * as Sentry from '@sentry/node'

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
  alchemyUrl = Number(chainId) == 1 ? ALCHEMY_API_URL :
    (Number(chainId) == 5 ? ALCHEMY_API_URL_GOERLI : ALCHEMY_API_URL_RINKEBY)
  web3 = createAlchemyWeb3(alchemyUrl)
}

export const initiateWeb3PreviewLink = (chainId?: string): AlchemyWeb3 => {
  chainId = chainId || process.env.CHAIN_ID // attach default value
  alchemyUrl = Number(chainId) == 1 ? process.env.ALCHEMY_API_KEY_PREVIEWLINK :
    Number(chainId) == 5 ? process.env.ALCHEMY_API_KEY_PREVIEWLINK_GOERLI : ''
  return createAlchemyWeb3(alchemyUrl)
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

export const getOwnersForNFT = async (
  nft: typeorm.DeepPartial<entity.NFT>,
): Promise<string[]> => {
  try {
    initiateWeb3(nft.chainId)
    const contract = ethers.utils.getAddress(nft.contract)
    const key = `getOwnersForNFT_${nft.chainId}_${contract}_${nft.tokenId}`
    const cachedData = await cache.get(key)

    if (cachedData) {
      return JSON.parse(cachedData) as string[]
    } else {
      const baseUrl = `${alchemyUrl}/getOwnersForToken?contractAddress=${contract}&tokenId=${nft.tokenId}`
      const response = await axios.get(baseUrl)

      if (response.data && response.data.owners) {
        await cache.set(key, JSON.stringify(response.data.owners), 'EX', 60 * 60) // 1 hour
        return response.data.owners as string[]
      } else {
        return []
      }
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
          try {
            await repositories.edge.hardDelete({ thatEntityId: dbNFT.id, edgeType: defs.EdgeType.Displays } )
            const owners = await getOwnersForNFT(dbNFT)
            if (owners.length) {
              if (owners.length > 1) {
                // This is ERC1155 token with multiple owners, so we don't update owner for now and delete NFT
                await repositories.edge.hardDelete({ thatEntityId: dbNFT.id } )
                  .then(() => repositories.nft.hardDelete({
                    id: dbNFT.id,
                  }))
                await seService.deleteNFT(dbNFT.id)
              } else {
                const newOwner = owners[0]
                // save User, Wallet for new owner addresses if it's not in our DB ...
                const wallet = await saveUsersForAssociatedAddress(dbNFT.chainId, newOwner, repositories)
                const user = await repositories.user.findOne({
                  where: {
                    username: 'ethereum-' + ethers.utils.getAddress(newOwner),
                  },
                })
                await repositories.nft.updateOneById(dbNFT.id, {
                  userId: user.id,
                  walletId: wallet.id,
                })
              }
            } else {
              // if there is no owner from api, then we just delete it from our DB
              await repositories.edge.hardDelete({ thatEntityId: dbNFT.id } )
                .then(() => repositories.nft.hardDelete({
                  id: dbNFT.id,
                }))
              await seService.deleteNFT(dbNFT.id)
            }
          } catch (err) {
            logger.error(`Error in filterNFTsWithAlchemy: ${err}`)
            Sentry.captureMessage(`Error in filterNFTsWithAlchemy: ${err}`)
          }
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
  optionalWeb3: (AlchemyWeb3 | undefined) = undefined,
): Promise<NFTMetaDataResponse | undefined> => {
  try {
    const response = await (optionalWeb3 || web3)?.alchemy.getNftMetadata({
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

    const metadata = nftMetadata?.metadata as any
    const name = nftMetadata?.title || `${contractMetadata.contractMetadata.name} #${Number(tokenId).toString()}`
    // For CryptoKitties, their metadata response format is different from original one
    const description = nftMetadata?.description || metadata?.bio
    const image = metadata?.image || metadata?.image_url_cdn || generateSVGFromBase64String(metadata?.image_data)
    if (nftMetadata?.id?.tokenMetadata.tokenType === 'ERC721') {
      type = defs.NFTType.ERC721
    } else if (nftMetadata?.id?.tokenMetadata?.tokenType === 'ERC1155') {
      type = defs.NFTType.ERC1155
    } else if (nftMetadata?.title.endsWith('.eth')) { // if token is ENS token...
      type = defs.NFTType.UNKNOWN
    }

    if (Array.isArray(metadata?.attributes)) {
      metadata?.attributes.map((trait) => {
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
    } else {
      if (nftMetadata?.metadata?.attributes) {
        Object.keys(nftMetadata?.metadata?.attributes).map(keys => {
          let value = nftMetadata?.metadata?.attributes?.[keys]
          value = typeof value === 'string' ? value : JSON.stringify(value)
          traits.push(({
            type: keys,
            value,
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
      return Promise.reject(new Error('File format is unacceptable'))
    } else {
      imageUrl = processIPFSURL(imageUrl)
      ext = extensionFromFilename(filename)

      if (!ext) {
        if (imageUrl.includes('https://metadata.ens.domains/')) {
          // this image is svg so we skip it
          return Promise.reject(new Error('File format is unacceptable'))
        } else if (imageUrl.includes('https://arweave.net/')) {
          // AR images are mp4 format, so we don't save as preview link
          return Promise.reject(new Error('File format is unacceptable'))
        } else {
          ext = 'png'
          imageKey = uploadPath + Date.now() + '-' + filename + '.png'
        }
      } else {
        if (ext === 'mp4' || ext === 'gif' || ext === 'svg' || ext === 'mp3') {
          return Promise.reject(new Error('File format is unacceptable'))
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
    throw err
  }
}

export const saveNFTMetadataImageToS3 = async (
  nft: entity.NFT,
  repositories: db.Repository,
): Promise<string | undefined> => {
  try {
    if (nft?.metadata?.imageURL && nft?.metadata?.imageURL.startsWith('https://cdn.nft.com')) {
      await repositories.nft.updateOneById(nft.id, {
        previewLink: nft.metadata.imageURL + '?width=600',
      })
      return nft.metadata.imageURL + '?width=600'
    } else {
      let uploadedImage
      const uploadPath = `nfts/${nft.chainId}/`

      const nftPortResult = await retrieveNFTDetailsNFTPort(nft.contract, nft.tokenId, nft.chainId)
      // if image url from NFTPortResult is valid
      if (nftPortResult && nftPortResult.nft.cached_file_url && nftPortResult.nft.cached_file_url.length) {
        const filename = nftPortResult.nft.cached_file_url.split('/').pop()
        uploadedImage = await uploadImageToS3(
          nftPortResult.nft.cached_file_url,
          filename,
          nft.chainId,
          nft.contract,
          uploadPath,
        )
      } else {
        const newWeb3 = initiateWeb3PreviewLink(nft.chainId)
        const nftAlchemyResult = await getNFTMetaDataFromAlchemy(nft.contract, nft.tokenId, newWeb3)
        if (nftAlchemyResult && nftAlchemyResult.metadata.image && nftAlchemyResult.metadata.image.length) {
          const filename = nftAlchemyResult.metadata.image.split('/').pop()
          uploadedImage = await uploadImageToS3(
            nftAlchemyResult.metadata.image,
            filename,
            nft.chainId,
            nft.contract,
            uploadPath,
          )
        } else {
          // we try to get url from metadata
          if (nft?.metadata?.imageURL && nft?.metadata?.imageURL.indexOf('data:image/svg+xml') === 0) {
            uploadedImage = await uploadImageToS3(nft.metadata.imageURL, `${nft.contract}.svg`, nft.chainId, nft.contract, uploadPath)
          } else {
            const imageUrl = processIPFSURL(nft?.metadata?.imageURL)
            if (!imageUrl) {
              await repositories.nft.updateOneById(nft.id, {
                previewLink: null,
                previewLinkError: 'undefined previewLink',
              })
              return undefined
            }
            const filename = nft.metadata.imageURL.split('/').pop()
            if (!filename) {
              await repositories.nft.updateOneById(nft.id, {
                previewLink: null,
                previewLinkError: 'undefined previewLink',
              })
              return undefined
            }
            uploadedImage = await uploadImageToS3(imageUrl, filename, nft.chainId, nft.contract, uploadPath)
          }
        }
      }

      if (!uploadedImage) {
        await repositories.nft.updateOneById(nft.id, {
          previewLink: null,
          previewLinkError: 'undefined previewLink',
        })
        return undefined
      }
      logger.info(`previewLink for NFT ${ nft.id } was generated`,
        {
          previewLink: uploadedImage + '?width=600',
        })
      return uploadedImage + '?width=600'
    }
  } catch (err) {
    await repositories.nft.updateOneById(nft.id, {
      previewLink: null,
      previewLinkError: typeof err.message === 'string' ? err.message : 'undefined previewLink',
    })

    logger.error(`Error in saveNFTMetadataImageToS3: ${err}`)
    Sentry.captureMessage(`Error in saveNFTMetadataImageToS3: ${err}`)
    return undefined
  }
}

export const updateNFTOwnershipAndMetadata = async (
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
      // save previewLink of NFT metadata image if it's from IPFS
      const previewLink = await saveNFTMetadataImageToS3(savedNFT, repositories)
      if (previewLink) {
        await repositories.nft.updateOneById(savedNFT.id, { previewLink, previewLinkError: null })
      }
      return savedNFT
    } else {
      // if this NFT is existing and owner changed, we change its ownership...
      if (existingNFT.userId !== userId || existingNFT.walletId !== walletId) {
        // we remove edge of previous profile
        await repositories.edge.hardDelete({ thatEntityId: existingNFT.id, edgeType: defs.EdgeType.Displays } )
        // if this NFT is a profile NFT...
        if (ethers.utils.getAddress(existingNFT.contract) ==
          ethers.utils.getAddress(contracts.nftProfileAddress(chainId))) {
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
          const updatedNFT = await repositories.nft.updateOneById(existingNFT.id, {
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
          if (existingNFT.metadata.imageURL !== image) {
            // update previewLink of NFT metadata image if it's from IPFS
            const previewLink = await saveNFTMetadataImageToS3(updatedNFT, repositories)
            if (previewLink) {
              await repositories.nft.updateOneById(updatedNFT.id, { previewLink, previewLinkError: null })
            }
          }
          return updatedNFT
        } else {
          logger.debug('No need to update owner and metadata', existingNFT.contract)
          return undefined
        }
      }
    }
  } catch (err) {
    console.log(err)
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
  await seService.indexNFTs(savedNFTs)
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

export const downloadAndUploadImageToS3 = async (
  chainId: string,
  url: string,
  fileName: string,
  uploadPath: string,
): Promise<string | undefined> => {
  try {
    const ext = extensionFromFilename(url)
    const fullName = ext ? fileName + '.' + ext : fileName
    const imageKey = uploadPath + Date.now() + '-' + fullName
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
      let description = 'placeholder collection description text'
      const uploadPath = `collections/${chainId}/`

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
            bannerUrl = banner ? banner : bannerUrl
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
    Sentry.captureMessage(`Error in getCollectionInfo: ${err}`)
    return err
  }
}

export const updateNFTMetadata = async (
  nft: entity.NFT,
  repositories: db.Repository,
): Promise<void> => {
  try {
    initiateWeb3(nft.chainId)
    const metadata = await getNFTMetaData(nft.contract, nft.tokenId)
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
    logger.debug(`Error in updateNFTMedata: ${err}`)
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
        // save User, Wallet for new owner addresses if it's not in our DB ...
        return await saveUsersForAssociatedAddress(chainId, owners[0], repositories)
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
    const metadata = await getNFTMetaData(contract, tokenId)
    if (!metadata) return undefined

    const { type, name, description, image, traits } = metadata
    const savedNFT = await repositories.nft.save({
      chainId: chainId,
      userId: wallet.userId,
      walletId: wallet.id,
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
    // save previewLink of NFT metadata image if it's from IPFS
    const previewLink = await saveNFTMetadataImageToS3(savedNFT, repositories)
    if (previewLink) {
      await repositories.nft.updateOneById(savedNFT.id, { previewLink, previewLinkError: null })
    }
    await seService.indexNFTs([savedNFT])
    await updateCollectionForNFTs([savedNFT])
    return savedNFT
  } catch (err) {
    logger.debug(`Error in saveNewNFT: ${err}`)
    Sentry.captureMessage(`Error in saveNewNFT: ${err}`)
  }
}

/**
 * getNFTActivities
 * @param activityType
 */

export const getNFTActivities = <T>(
  activityType: defs.ActivityType,
) => {
  return async (parent: T, args: unknown, ctx: Context): Promise<Pageable<entity.TxActivity> | null> => {
    let pageInput: gql.PageInput = args?.['listingsPageInput']
    const expirationType: gql.ActivityExpiration = args?.['listingsExpirationType']
    const listingsStatus: defs.ActivityStatus = args?.['listingsStatus'] || defs.ActivityStatus.Valid
    let listingsOwnerAddress: string = args?.['listingsOwner']
    if (!listingsOwnerAddress) {
      const walletId = parent?.['walletId']
      const wallet: entity.Wallet = await ctx.repositories.wallet.findById(walletId)
      listingsOwnerAddress = wallet?.address
    }

    if (!pageInput) {
      pageInput = {
        'first': 50,
      }
    }
    const contract = parent?.['contract']
    const tokenId = parent?.['tokenId']
    const chainId = parent?.['chainId'] || process.env.chainId

    if (contract && tokenId) {
      const checksumContract = helper.checkSum(contract)
      const nftId = `ethereum/${checksumContract}/${BigNumber.from(tokenId).toHexString()}`
      let filters: defs.ActivityFilters = {
        nftContract: checksumContract,
        nftId,
        activityType,
        status: listingsStatus,
        walletAddress: helper.checkSum(listingsOwnerAddress),
        chainId,
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
      )
        .then(pagination.toPageable(pageInput, null, null, 'createdAt'))
    }
  }
}
