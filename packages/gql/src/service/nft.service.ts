import { BigNumber, ethers, providers } from 'ethers'
import * as Lodash from 'lodash'
import * as typeorm from 'typeorm'

//import Typesense from 'typesense'
import { AlchemyWeb3, createAlchemyWeb3 } from '@alch/alchemy-web3'
import { _logger, db, defs, entity, fp, provider, typechain } from '@nftcom/shared'

const repositories = db.newRepositories()
const logger = _logger.Factory(_logger.Context.Misc, _logger.Context.GraphQL)

const network = process.env.SUPPORTED_NETWORKS.split(':')[2]
const ALCHEMY_API_URL_RINKEBY = process.env.ALCHEMY_API_URL_RINKEBY
const ALCHEMY_API_URL_MAINNET = process.env.ALCHEMY_API_URL_MAINNET
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

export const initiateWeb3 = (chainId: string): void => {
  web3 = chainId === '1' ? createAlchemyWeb3(ALCHEMY_API_URL_MAINNET) :
    createAlchemyWeb3(ALCHEMY_API_URL_RINKEBY)
}

export const getNFTsFromAlchemy = async (owner: string): Promise<OwnedNFT[]> => {
  try {
    const response = await web3.alchemy.getNfts({
      owner: owner,
      withMetadata: false,
    })
    if (response.ownedNfts) {
      return response.ownedNfts as OwnedNFT[]
    } else {
      return []
    }
  } catch (err) {
    console.log('error: ', err)
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
    const response = await web3.alchemy.getNfts({
      owner: owner,
      contractAddresses: contracts,
    })
    if (!response.ownedNfts) {
      return []
    }
    const ownedNfts = response.ownedNfts

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
          await repositories.edge.delete({ thatEntityId: dbNFT.id } )
            .then(() => repositories.nft.delete({
              id: dbNFT.id,
            }))
        }
      }),
    )
  } catch (err) {
    console.log('error: ', err)
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
    console.log('error: ', err)
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
      console.log('Token type not ERC721, ERC1155, nor UNKNOWN', type)
      return Promise.resolve('Unknown Name')
    }
  } catch (error) {
    console.log('ethers failed: ', error)
    return Promise.resolve('Unknown Name')
  }
}

const updateEntity = async (
  nftInfo: NFTMetaDataResponse,
  userId: string,
  walletId: string,
  profileId?: string,
): Promise<void> => {
  let newNFT
  // let newCollection
  try {
    const existingNFT = await repositories.nft.findOne({
      where: {
        contract: ethers.utils.getAddress(nftInfo.contract.address),
        tokenId: BigNumber.from(nftInfo.id.tokenId).toHexString(),
      },
    })

    let type: defs.NFTType
    if (nftInfo.id.tokenMetadata.tokenType === 'ERC721') {
      type = defs.NFTType.ERC721
    } else if (nftInfo.id.tokenMetadata.tokenType === 'ERC1155') {
      type = defs.NFTType.ERC1155
    } else {
      console.log('Token type should be ERC721 or ERC1155, not ', nftInfo?.id?.tokenMetadata?.tokenType, nftInfo)
      return
    }
    const traits = []
    if (nftInfo.metadata.attributes) {
      try {
        if (Array.isArray(nftInfo.metadata.attributes)) {
          nftInfo.metadata.attributes.map((trait) => {
            traits.push(({
              type: trait?.trait_type,
              value: trait?.value,
            }))
          })
        } else {
          Object.keys(nftInfo.metadata.attributes).map(keys => {
            traits.push(({
              type: keys,
              value: nftInfo.metadata.attributes[keys],
            }))
          })
        }
      } catch (err) {
        logger.error('error while parsing traits', err, nftInfo, nftInfo.metadata, nftInfo.metadata.attributes)
      }
    }
    newNFT = await repositories.nft.save({
      ...existingNFT,
      contract: ethers.utils.getAddress(nftInfo.contract.address),
      tokenId: BigNumber.from(nftInfo.id.tokenId).toHexString(),
      metadata: {
        name: nftInfo.title,
        description: nftInfo.description,
        imageURL: nftInfo.metadata.image,
        traits: traits,
      },
      type: type,
      userId: userId,
      walletId: walletId,
    })

    if (newNFT) {
      if (profileId) {
        newNFT = await repositories.nft.updateOneById(newNFT.id, {
          profileId: profileId,
        })
      }
      await repositories.collection.findOne({
        where: { contract: ethers.utils.getAddress(newNFT.contract) },
      })
        .then(fp.thruIfEmpty(() => {
          // find & save collection name
          return getCollectionNameFromContract(newNFT.contract, newNFT.type, network)
            .then(async (collectionName: string) => {
              logger.debug('new collection', { collectionName, contract: newNFT.contract })
              //newCollection = true

              return repositories.collection.save({
                contract: ethers.utils.getAddress(newNFT.contract),
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
            thatEntityId: newNFT.id,
            edgeType: defs.EdgeType.Includes,
          }
          repositories.edge.findOne({ where: edgeVals })
            .then(fp.tapIfEmpty(() => repositories.edge.save(edgeVals)))
        })
    }
  } catch (err) {
    console.log('error update entity: ', err)
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
    console.log('error check nft contract address: ', err)
    return []
  }
}

/**
 * check if NFTs of users are sold or transferred to different address...
 * @param users
 */
// const checkOwnedNFTs = async (users: entity.User[]): Promise<void[]> => {
//   try {
//     return await Promise.all(
//       users.map(async (user: entity.User) => {
//         const wallets = await repositories.wallet.findByUserId(user.id)
//         await Promise.all(
//           wallets.map(async (wallet: entity.Wallet) => {
//             await checkNFTContractAddresses(user.id, wallet.id, wallet.address)
//           }),
//         )
//       }),
//     )
//   } catch (err) {
//     console.log('error check owned NFTs: ', err)
//     return []
//   }
// }

/**
 * update wallet NFTs using data from alchemy api
 * @param userId
 * @param walletId
 * @param walletAddress
 * @param profileId
 */
export const updateWalletNFTs = async (
  userId: string,
  walletId: string,
  walletAddress: string,
  profileId?: string,
): Promise<void> => {
  const ownedNFTs = await getNFTsFromAlchemy(walletAddress)
  await Promise.allSettled(
    ownedNFTs.map(async (nft: OwnedNFT) => {
      const response = await getNFTMetaDataFromAlchemy(nft.contract.address, nft.id.tokenId)
      if (response) {
        await updateEntity(response, userId, walletId, profileId)
      }
    }),
  )
}

/**
 * get owned NFTs of users...
 * @param users
 */
// const getOwnedNFTs = async (users: entity.User[]): Promise<void[]> => {
//   return await Promise.all(
//     users.map(async (user: entity.User) => {
//       const wallets = await repositories.wallet.findByUserId(user.id)
//       await Promise.all(
//         wallets.map(async (wallet: entity.Wallet) => {
//           await updateWalletNFTs(user.id, wallet.id, wallet.address)
//         }),
//       )
//     }),
//   )
// }

// export const getUsersNFTs = async (job: Job): Promise<any> => {
//   try {
//     logger.debug('user nft job', { job })
//     const users = await repositories.user.findAll()
//     await checkOwnedNFTs(users)
//     return await getOwnedNFTs(users)
//   } catch (err) {
//     console.log('error fetching nft data: ', err)
//   }
// }
