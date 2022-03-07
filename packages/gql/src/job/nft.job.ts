import { Job } from 'bull'
import { BigNumber, ethers, providers } from 'ethers'
import * as Lodash from 'lodash'
import * as typeorm from 'typeorm'
import Typesense from 'typesense'

import { createAlchemyWeb3 } from '@alch/alchemy-web3'
import { _logger, db, defs, entity, fp, provider, typechain } from '@nftcom/shared'

const repositories = db.newRepositories()
const logger = _logger.Factory(_logger.Context.Misc, _logger.Context.GraphQL)
const network = process.env.SUPPORTED_NETWORKS.split(':')[2]
const ALCHEMY_NFT_API_URL = process.env.ALCHEMY_NFT_API_URL
const web3 = createAlchemyWeb3(ALCHEMY_NFT_API_URL)
const TYPESENSE_HOST = '3.87.139.177' //process.env.TYPESENSE_APP_ID
const TYPESENSE_API_KEY = 'TiwsolWyPwgfGmOvhw9yavpVuWz1YnM4fxHh65BH8JFr6oV4' // process.env.TYPESENSE_API_KEY

const client = new Typesense.Client({
  'nodes': [{
    'host': TYPESENSE_HOST, // For Typesense Cloud use xxx.a1.typesense.net
    'port': 8108,      // For Typesense Cloud use 443
    'protocol': 'http',   // For Typesense Cloud use https
  }],
  'apiKey': TYPESENSE_API_KEY,
  'connectionTimeoutSeconds': 2,
})

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

/*
// typesense types/interfaces 
type CollectionFieldType = 'string' | 'int32' | 'int64' | 'float' | 'bool' | 'geopoint' | 'geopoint[]' | 'string[]' | 'int32[]' | 'int64[]' | 'float[]' | 'bool[]' | 'auto' | 'string*'

interface CollectionFieldSchema {
  name: string
  type: CollectionFieldType
  optional?: boolean
  facet?: boolean
  index?: boolean
}

interface CollectionCreateSchema {
  name: string
  default_sorting_field?: string
  fields: CollectionFieldSchema[]
  symbols_to_index?: string[]
  token_separators?: string[]
}*/

const getNFTsFromAlchemy = async (owner: string): Promise<OwnedNFT[]> => {
  try {
    const response = await web3.alchemy.getNfts({
      owner: owner,
      withMetadata: false,
    })
    return response.ownedNfts as OwnedNFT[]
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
    const ownedNfts = response.ownedNfts

    const checksum = ethers.utils.getAddress

    return await Promise.all(
      nfts.map(async (dbNFT: typeorm.DeepPartial<entity.NFT>) => {
        const index = ownedNfts.findIndex((ownedNFT: OwnedNFT) =>
          checksum(ownedNFT.contract.address) === checksum(dbNFT.contract) &&
          BigNumber.from(ownedNFT.id.tokenId).toString() === dbNFT.tokenId,
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
    } else if (type === defs.NFTType.ERC1155) {
      const tokenContract = typechain.ERC1155__factory.connect(
        contractAddress,
        provider.provider(network),
      )
      return tokenContract.name().catch(() => Promise.resolve('Unknown Name'))
    } else {
      console.log('Token type should be ERC721 or ERC1155, not ', type)
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
): Promise<void> => {
  let newNFT
  try {
    const existingNFT = await repositories.nft.findOne({
      where: {
        contract: ethers.utils.getAddress(nftInfo.contract.address),
        tokenId: BigNumber.from(nftInfo.id.tokenId).toString(),
      },
    })
    
    let type: defs.NFTType
    if (nftInfo.id.tokenMetadata.tokenType === 'ERC721') {
      type = defs.NFTType.ERC721
    } else if (nftInfo.id.tokenMetadata.tokenType === 'ERC1155') {
      type = defs.NFTType.ERC1155
    } else {
      console.log('Token type should be ERC721 or ERC1155, not ', nftInfo?.id?.tokenMetadata?.tokenType)
      return
    }
    const traits = []
    if (nftInfo.metadata.attributes) {
      nftInfo.metadata.attributes.map((trait) => {
        traits.push(({
          type: trait?.trait_type,
          value: trait?.value,
        }))
      })
    }
    newNFT = await repositories.nft.save({
      ...existingNFT,
      contract: ethers.utils.getAddress(nftInfo.contract.address),
      tokenId: BigNumber.from(nftInfo.id.tokenId).toString(),
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
    console.log('newNFT activated, newNFT: ' + newNFT)
    if (newNFT && !existingNFT) {
      console.log('this is a new (not existing) nft - search engine to index new document')
      const indexNft = []
      indexNft.push({
        contract: nftInfo.contract.address,
        tokenId: BigNumber.from(nftInfo.id.tokenId).toString(),
        type: type,
        name: nftInfo.title,
      })
      client.collections('nfts').documents().import(indexNft,{ action : 'create' })
    } else if (newNFT && existingNFT) {
      console.log('this is an existing nft')
    }

    if (newNFT) {
      await repositories.collection.findOne({
        where: { contract: ethers.utils.getAddress(newNFT.contract) },
      })
        .then(fp.thruIfEmpty(() => {
          return getCollectionNameFromContract(newNFT.contract, newNFT.type, network)
            .then((collectionName: string) => {
              logger.debug('new collection', { collectionName, contract: newNFT.contract })
              return repositories.collection.save({
                contract: ethers.utils.getAddress(newNFT.contract),
                name: collectionName,
              })
            })
        }))
        .then((collection: entity.Collection) => {
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
    console.log('error: ', err)
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

    nftsChunks.forEach(async (nftChunk: entity.NFT[]) => {
      await filterNFTsWithAlchemy(nftChunk, walletAddress)
    })
  } catch (err) {
    console.log('error: ', err)
    return []
  }
}

/**
 * check if NFTs of users are sold or transferred to different address...
 * @param users
 */
const checkOwnedNFTs = async (users: entity.User[]): Promise<void[]> => {
  try {
    return await Promise.all(
      users.map(async (user: entity.User) => {
        const wallets = await repositories.wallet.findByUserId(user.id)
        await Promise.all(
          wallets.map(async (wallet: entity.Wallet) => {
            await checkNFTContractAddresses(user.id, wallet.id, wallet.address)
          }),
        )
      }),
    )
  } catch (err) {
    console.log('error: ', err)
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
  ownedNFTs.reduce(async (memo: any, nft: OwnedNFT) => {
    await memo
    const response = await getNFTMetaDataFromAlchemy(nft.contract.address, nft.id.tokenId)
    if (response) {
      await updateEntity(response, userId, walletId)
    }
  }, null)
}

/**
 * get owned NFTs of users...
 * @param users
 */
const getOwnedNFTs = async (users: entity.User[]): Promise<void[]> => {
  return await Promise.all(
    users.map(async (user: entity.User) => {
      const wallets = await repositories.wallet.findByUserId(user.id)
      await Promise.all(
        wallets.map(async (wallet: entity.Wallet) => {
          await updateWalletNFTs(user.id, wallet.id, wallet.address)
        }),
      )
    }),
  )
}

export const getUsersNFTs = async (job: Job): Promise<any> => {
  try {
    logger.debug('user nft job', { job })
    const users = await repositories.user.findAll()
    await checkOwnedNFTs(users)
    return await getOwnedNFTs(users)
  } catch (err) {
    console.log('error: ', err)
  }
}
