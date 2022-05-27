import { BigNumber, ethers, providers } from 'ethers'
import * as Lodash from 'lodash'
import * as typeorm from 'typeorm'

//import Typesense from 'typesense'
import { AlchemyWeb3, createAlchemyWeb3 } from '@alch/alchemy-web3'
import { _logger, db, defs, entity, fp, provider, typechain } from '@nftcom/shared'
import * as Sentry from '@sentry/node'

const repositories = db.newRepositories()
const logger = _logger.Factory(_logger.Context.Misc, _logger.Context.GraphQL)

const network = process.env.SUPPORTED_NETWORKS.split(':')[2]
const ALCHEMY_API_URL = process.env.ALCHEMY_API_URL
let web3: AlchemyWeb3

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

export const initiateWeb3 = (): void => {
  web3 = createAlchemyWeb3(ALCHEMY_API_URL)
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
    Sentry.captureException(err)
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
    Sentry.captureException(err)
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
    Sentry.captureException(err)
    Sentry.captureMessage(`Error in getNFTMetaDataFromAlchemy: ${err}`)
    return undefined
  }
}

const getCollectionNameFromContract = (
  contractAddress: string,
  type:  defs.NFTType,
  network: providers.Networkish,
): Promise<string> => {
  try {
    if (type === defs.NFTType.ERC721) {
      const tokenContract = typechain.ERC721__factory.connect(
        contractAddress,
        provider.provider(network),
      )
      return tokenContract.name().catch(() => Promise.resolve('Unknown Name'))
    } else if (type === defs.NFTType.ERC1155 || type === defs.NFTType.UNKNOWN) {
      const tokenContract = typechain.ERC1155__factory.connect(
        contractAddress,
        provider.provider(network),
      )
      return tokenContract.name().catch(() => Promise.resolve('Unknown Name'))
    } else {
      logger.error('Token type not ERC721, ERC1155, nor UNKNOWN', type)
      return Promise.resolve('Unknown Name')
    }
  } catch (error) {
    logger.error('ethers failed: ', error)
    return Promise.resolve('Unknown Name')
  }
}

const updateCollection = async (
  nft: entity.NFT,
): Promise<void> => {
  return repositories.collection.findOne({
    where: { contract: ethers.utils.getAddress(nft.contract) },
  })
    .then(fp.thruIfEmpty(() => {
      // find & save collection name
      return getCollectionNameFromContract(nft.contract, nft.type, network)
        .then(async (collectionName: string) => {
          logger.debug('new collection', { collectionName, contract: nft.contract })

          return repositories.collection.save({
            contract: ethers.utils.getAddress(nft.contract),
            name: collectionName,
          })
        })
    }))
    .then(async (collection: entity.Collection) => {
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

      // update edgeVals
      const edgeVals = {
        thisEntityType: defs.EntityType.Collection,
        thatEntityType: defs.EntityType.NFT,
        thisEntityId: collection.id,
        thatEntityId: nft.id,
        edgeType: defs.EdgeType.Includes,
      }
      repositories.edge.findOne({ where: edgeVals })
        .then(fp.tapIfEmpty(() => repositories.edge.save(edgeVals)))
    })
}

const updateNFTOwnershipAndMetadata = async (
  nft: OwnedNFT,
  userId: string,
  walletId: string,
): Promise<void> => {
  const existingNFT = await repositories.nft.findOne({
    where: {
      contract: ethers.utils.getAddress(nft.contract.address),
      tokenId: BigNumber.from(nft.id.tokenId).toHexString(),
    },
  })
  if (existingNFT?.userId !== userId || existingNFT?.walletId !== walletId) {
    let type: defs.NFTType = existingNFT?.type
    const traits = existingNFT?.metadata?.traits
    let name = existingNFT?.metadata?.name
    let description = existingNFT?.metadata?.description
    let image = existingNFT?.metadata?.imageURL

    if (existingNFT == null) {
      const nftMetadata: NFTMetaDataResponse = await getNFTMetaDataFromAlchemy(
        nft.contract.address,
        nft.id.tokenId,
      )
      name = nftMetadata?.title
      description = nftMetadata?.description
      image = nftMetadata?.metadata?.image
      if (nftMetadata.id.tokenMetadata.tokenType === 'ERC721') {
        type = defs.NFTType.ERC721
      } else if (nftMetadata.id.tokenMetadata.tokenType === 'ERC1155') {
        type = defs.NFTType.ERC1155
      }
      try {
        if (Array.isArray(nftMetadata.metadata.attributes)) {
          nftMetadata.metadata.attributes.map((trait) => {
            traits.push(({
              type: trait?.trait_type,
              value: trait?.value,
            }))
          })
        } else {
          Object.keys(nftMetadata.metadata.attributes).map(keys => {
            traits.push(({
              type: keys,
              value: nftMetadata.metadata.attributes[keys],
            }))
          })
        }
      } catch (err) {
        Sentry.captureException(err)
        Sentry.captureMessage(`Error in updateNFTOwnershipAndMetadata: ${err}`)
      }
    }

    await repositories.nft.save({
      ...existingNFT,
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
      .then(fp.tap(updateCollection))
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
): Promise<void[]> => {
  try {
    const nfts = await repositories.nft.find({ where: { userId: userId, walletId: walletId } })
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
    Sentry.captureException(err)
    Sentry.captureMessage(`Error in checkNFTContractAddresses: ${err}`)
    return []
  }
}

/**
 * update wallet NFTs using data from alchemy api
 * @param userId
 * @param walletId
 * @param walletAddress
 */
export const updateWalletNFTs = async (
  userId: string,
  walletId: string,
  walletAddress: string,
): Promise<void> => {
  const ownedNFTs = await getNFTsFromAlchemy(walletAddress)
  await Promise.allSettled(
    ownedNFTs.map(async (nft: OwnedNFT) => {
      await updateNFTOwnershipAndMetadata(nft, userId, walletId)
    }),
  )
}

const hideAllNFTs = async (
  repositories: db.Repository,
  profileId: string,
): Promise<void> => {
  await repositories.edge.hardDelete({
    thisEntityType: defs.EntityType.Profile,
    thisEntityId: profileId,
    edgeType: defs.EdgeType.Displays,
    thatEntityType: defs.EntityType.NFT,
  })
}

const showAllNFTs = async (
  repositories: db.Repository,
  userId: string,
  profileId: string,
): Promise<void> => {
  const nfts = await repositories.nft.find({ where: { userId } })
  if (nfts.length) {
    await Promise.allSettled(
      nfts.map(async (nft) => {
        const displayEdge = await repositories.edge.findOne({
          where: {
            thisEntityType: defs.EntityType.Profile,
            thatEntityType: defs.EntityType.NFT,
            thisEntityId: profileId,
            thatEntityId: nft.id,
            edgeType: defs.EdgeType.Displays,
          },
        })
        if (!displayEdge) {
          await repositories.edge.save({
            thisEntityType: defs.EntityType.Profile,
            thatEntityType: defs.EntityType.NFT,
            thisEntityId: profileId,
            thatEntityId: nft.id,
            edgeType: defs.EdgeType.Displays,
          })
        }
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
 */
export const changeNFTsVisibility = async (
  repositories: db.Repository,
  userId: string,
  profileId: string,
  showAll: boolean,
  hideAll: boolean,
  showNFTIds: Array<string> | null,
  hideNFTIds: Array<string> | null,
): Promise<void> => {
  try {
    if (showAll) {
      await showAllNFTs(repositories, userId, profileId)
      return
    } else if (hideAll) {
      await hideAllNFTs(repositories, profileId)
      return
    } else {
      if (showNFTIds?.length) {
        await Promise.allSettled(
          showNFTIds?.map(async (id) => {
            const existingNFT = await repositories.nft.findOne({ where: { id } })
            if (!existingNFT) {
              return
            }
            const edgeVals = {
              thisEntityId: profileId,
              thisEntityType: defs.EntityType.Profile,
              thatEntityId: existingNFT.id,
              thatEntityType: defs.EntityType.NFT,
              edgeType: defs.EdgeType.Displays,
            }
            const existingEdge = await repositories.edge.findOne({ where: edgeVals })
            if (!existingEdge) {
              repositories.edge.save(edgeVals)
            }
          }),
        )
      }
      if (hideNFTIds) {
        await Promise.allSettled(
          hideNFTIds?.map(async (id) => {
            const existingNFT = await repositories.nft.findOne({ where: { id: id } })
            if (existingNFT) {
              return repositories.edge.hardDelete({
                thisEntityId: profileId,
                thisEntityType: defs.EntityType.Profile,
                thatEntityId: existingNFT.id,
                thatEntityType: defs.EntityType.NFT,
                edgeType: defs.EdgeType.Displays,
              })
            }
          }),
        )
      }
    }
  } catch (err) {
    Sentry.captureException(err)
    Sentry.captureMessage(`Error in changeNFTsVisibility: ${err}`)
  }
}
