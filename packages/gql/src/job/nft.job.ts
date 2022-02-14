import axios from 'axios'
import { Job } from 'bull'
import * as Lodash from 'lodash'

import { db, entity, fp, provider } from '@nftcom/shared'
import { EdgeType, EntityType, NFTType } from '@nftcom/shared/defs'
import { typechain } from '@nftcom/shared/helper'

const repositories = db.newRepositories()
const network = process.env.SUPPORTED_NETWORKS.split(':')[2]
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY
const ALCHEMY_API_URL = `https://eth-${network}.g.alchemy.com/${ALCHEMY_API_KEY}/v1`

interface OwnedNFT {
  contract: {
    address: string
  }
  id: {
    tokenId: string
  }
}
interface AlternateMedia {
  uri: string
}
interface Trait {
  trait_type: string
  value: string
  display_type?: string
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
  externalDomainViewUrl: string
  media: {
    uri: string
  }
  alternateMedia: AlternateMedia[]
  metadata: {
    name: string
    description: string
    image: string
    attributes: Trait[]
  }
  timeLastUpdated: string
}
interface NFT {
  contract: string
  tokenId: string
}

const getNFTsFromAlchemy = async (owner: string): Promise<OwnedNFT[]> => {
  const url = `${ALCHEMY_API_URL}/getNFTs/?owner=${owner}`
  try {
    const result = await axios.get(url)
    return result.data.ownedNfts as OwnedNFT[]
  } catch (err) {
    console.log('error: ', err)
    return []
  }
}

const filterNFTsWithAlchemy = async (
  nfts: Array<NFT>,
  owner: string,
): Promise<any[]> => {
  let url = `${ALCHEMY_API_URL}/getNFTs/?owner=${owner}`
  nfts.forEach((nft: NFT) => {
    url = url.concat(`&contractAddresses%5B%5D=${nft.contract}`)
  })
  try {
    const result = await axios.get(url)
    const ownedNfts = result.data.ownedNfts

    return await Promise.all(
      nfts.map(async (alchemyNft: NFT) => {
        const index = ownedNfts.findIndex((ownedNFT: OwnedNFT) =>
          ownedNFT.contract.address === alchemyNft.contract &&
          ownedNFT.id.tokenId === alchemyNft.tokenId,
        )
        // if contract owner has changed ...
        if (index === -1) {
          const nftRecord = await repositories.nft.findOne({
            where: { contract: alchemyNft.contract, tokenId: alchemyNft.tokenId },
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
  const url = `${ALCHEMY_API_URL}/getNFTMetadata?contractAddress=${contractAddress}&tokenId=${tokenId}`
  try {
    const result = await axios.get(url)
    return result.data as NFTMetaDataResponse
  } catch (err) {
    console.log('error: ', err)
    return undefined
  }
}

const getCollectionNameFromContract = (
  contractAddress: string,
  type:  NFTType,
): Promise<string> => {
  try {
    if (type === NFTType.ERC721) {
      const tokenContract = typechain.ERC721__factory.connect(
        contractAddress,
        provider.provider(),
      )
      return tokenContract.name().catch(() => Promise.resolve('Unknown Name'))
    } else if (type === NFTType.ERC1155) {
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
      where: { contract: nftInfo.contract.address, tokenId: nftInfo.id.tokenId },
    })
    console.log('NFT collection job updates row on NFT table')
    let type: NFTType
    if (nftInfo.id.tokenMetadata.tokenType === 'ERC721') {
      type = NFTType.ERC721
    } else if (nftInfo.id.tokenMetadata.tokenType === 'ERC1155') {
      type = NFTType.ERC1155
    } else {
      console.log('Token type should be ERC721 or ERC1155, not ', nftInfo?.id?.tokenMetadata?.tokenType)
      return
    }
    const traits = []
    if (nftInfo.metadata.attributes) {
      nftInfo.metadata.attributes.map((trait) => {
        traits.push(({
          type: trait.trait_type,
          value: trait.value,
        }))
      })
    }
    newNFT = await repositories.nft.save({
      ...existingNFT,
      contract: nftInfo.contract.address,
      tokenId: nftInfo.id.tokenId,
      metadata: {
        name: nftInfo.metadata.name,
        description: nftInfo.metadata.description,
        imageURL: nftInfo.metadata.image,
        traits: traits,
      },
      type: type,
      userId: userId,
      walletId: walletId,
    })
  } catch (err) {
    console.log('error: ', err)
  }
  if (newNFT) {
    await repositories.collection.findOne({ where: { contract: newNFT.contract } })
      .then(fp.thruIfEmpty(() => {
        return getCollectionNameFromContract(newNFT.contract, newNFT.type)
          .then((collectionName: string) => {
            console.log('got name ', collectionName, ' , trying to save')
            return repositories.collection.save({
              contract: newNFT.contract,
              name: collectionName,
            })
          })
      }))
      .then((collection: entity.Collection) => {
        const edgeVals = {
          thisEntityType: EntityType.Collection,
          thatEntityType: EntityType.NFT,
          thisEntityId: collection.id,
          thatEntityId: newNFT.id,
          edgeType: EdgeType.Includes,
        }
        repositories.edge.findOne({ where: edgeVals })
          .then(fp.tapIfEmpty(() => repositories.edge.save(edgeVals)))
      })
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
      nfts.map((nft: entity.NFT) => ({ contract: nft.contract, tokenId: nft.tokenId })),
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
  console.log('getUsersNFTs: ', job)
  try {
    const users = await repositories.user.findAll()
    await checkOwnedNFTs(users)
    return await getOwnedNFTs(users)
  } catch (err) {
    console.log('error: ', err)
  }
}
