import axios from 'axios'
import { Job } from 'bull'
import * as Lodash from 'lodash'

import { db, entity } from '@nftcom/shared'
import { NFTType } from '@nftcom/shared/defs'

const repositories = db.newRepositories()
const ALCHEMY_API_KEY = process.env.REACT_APP_ALCHEMY_API_KEY
const ALCHEMY_API_URL = `https://eth-mainnet.g.alchemy.com/${ALCHEMY_API_KEY}/v1`

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
  contractChunks: string[],
  owner: string,
): Promise<void[]> => {
  let url = `${ALCHEMY_API_URL}/getNFTs/?owner=${owner}`
  contractChunks.map((contract: string) => {
    url = url.concat(`&contractAddresses%5B%5D=${contract}`)
  })
  try {
    const result = await axios.get(url)
    const ownedNfts = result.data.ownedNfts
    return await Promise.all(
      contractChunks.map(async (contract) => {
        const index = ownedNfts.findIndex((nft) => nft.contract.address === contract)
        // if contract owner has changed ...
        if (index === -1)
          await repositories.nft.delete({ contract: contract })
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

const updateEntity = async (
  nftInfo: NFTMetaDataResponse,
  userId: string,
  walletId: string,
): Promise<void> => {
  try {
    const existingNFT = await repositories.nft.findOne({
      where: { contract: nftInfo.contract.address },
    })
    // if this NFT is not existing on the NFT table, we save nft information...
    if (!existingNFT) {
      console.log('NFT collection job updates row on NFT table')
      let type
      if (nftInfo.id.tokenMetadata.tokenType === 'ERC721') {
        type = NFTType.ERC721
      } else if (nftInfo.id.tokenMetadata.tokenType === 'ERC1155') {
        type = NFTType.ERC1155
      } else {
        console.log('Token type should be ERC721 or ERC1155')
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
      await repositories.nft.save({
        contract: nftInfo.contract.address,
        metadata: {
          name: nftInfo.metadata.name,
          description: nftInfo.metadata.description,
          tokenId: nftInfo.id.tokenId,
          imageURL: nftInfo.metadata.image,
          traits: traits,
        },
        type: type,
        userId: userId,
        walletId: walletId,
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
  const contractAddresses = []
  try {
    const nfts = await repositories.nft.find({ where: { userId: userId, walletId: walletId } })
    nfts.map((nft: entity.NFT) => {
      contractAddresses.push(nft.contract)
    })
    if (!contractAddresses.length) return []
    const contractsChunks = Lodash.chunk(contractAddresses, 20)
    return await Promise.all(
      contractsChunks.map(async (contracts: string[]) => {
        await filterNFTsWithAlchemy(contracts, walletAddress)
      }),
    )
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
