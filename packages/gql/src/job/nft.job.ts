import { Job } from 'bull'
import { ethers } from 'ethers'
import * as Lodash from 'lodash'

import { createAlchemyWeb3 } from '@alch/alchemy-web3'
import { _logger, db, defs, entity, fp, provider, typechain } from '@nftcom/shared'

const repositories = db.newRepositories()
const logger = _logger.Factory(_logger.Context.Misc, _logger.Context.GraphQL)
const network = process.env.SUPPORTED_NETWORKS.split(':')[2]
const ALCHEMY_API_URL = `https://eth-${network}.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
const web3 = createAlchemyWeb3(ALCHEMY_API_URL)
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
interface NFT {
  contract: string
  tokenId: string
}

const getNFTsFromAlchemy = async (owner: string): Promise<OwnedNFT[]> => {
  try {
    const response = await web3.alchemy.getNfts({
      owner: owner,
    })
    return response.ownedNfts as OwnedNFT[]
  } catch (err) {
    console.log('error: ', err)
    return []
  }
}

const filterNFTsWithAlchemy = async (
  nfts: Array<NFT>,
  owner: string,
): Promise<any[]> => {
  const contracts = []
  nfts.forEach((nft: NFT) => {
    contracts.push(nft.contract)
  })
  try {
    const response = await web3.alchemy.getNfts({
      owner: owner,
      contractAddresses: contracts,
    })
    const ownedNfts = response.ownedNfts

    return await Promise.all(
      nfts.map(async (alchemyNft: NFT) => {
        const index = ownedNfts.findIndex((ownedNFT: OwnedNFT) =>
          ownedNFT.contract.address === alchemyNft.contract &&
          ownedNFT.id.tokenId === alchemyNft.tokenId,
        )
        // if contract owner has changed ...
        if (index === -1) {
          const nftRecord = await repositories.nft.findOne({
            where: {
              contract: ethers.utils.getAddress(alchemyNft.contract),
              tokenId: alchemyNft.tokenId,
            },
          })
          await repositories.nft.delete(nftRecord)
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
): Promise<string> => {
  try {
    if (type === defs.NFTType.ERC721) {
      const tokenContract = typechain.ERC721__factory.connect(
        contractAddress,
        provider.provider(),
      )
      return tokenContract.name().catch(() => Promise.resolve('Unknown Name'))
    } else if (type === defs.NFTType.ERC1155) {
      const tokenContract = typechain.ERC1155__factory.connect(
        contractAddress,
        provider.provider(),
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
        tokenId: nftInfo.id.tokenId,
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
          type: trait[0],
          value: trait[1],
        }))
      })
    }
    newNFT = await repositories.nft.save({
      ...existingNFT,
      contract: ethers.utils.getAddress(nftInfo.contract.address),
      tokenId: nftInfo.id.tokenId,
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
      await repositories.collection.findOne({ where: {
        contract: ethers.utils.getAddress(newNFT.contract),
      } })
        .then(fp.thruIfEmpty(() => {
          return getCollectionNameFromContract(newNFT.contract, newNFT.type)
            .then((collectionName: string) => {
              logger.debug('new collection name', { collectionName })
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
    const nftsChunks: NFT[][] = Lodash.chunk(
      nfts.map((nft: entity.NFT) => ({
        contract: ethers.utils.getAddress(nft.contract),
        tokenId: nft.tokenId,
      })),
      20,
    )

    nftsChunks.forEach(async (nftChunk: NFT[]) => {
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
): Promise<void[]> => {
  const ownedNFTs = await getNFTsFromAlchemy(walletAddress)
  return await Promise.all(
    ownedNFTs.map(async (nft: OwnedNFT) => {
      const response = await getNFTMetaDataFromAlchemy(nft.contract.address, nft.id.tokenId)

      if (response)
        await updateEntity(response, userId, walletId)
    }),
  )
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
