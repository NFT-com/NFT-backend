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

const getNFTsFromAlchemy = (owner: string): Promise<OwnedNFT[]> => {
  const url = `${ALCHEMY_API_URL}/getNFTs/?owner=${owner}`
  return axios.get(url).then((result) => {
    return result.data.ownedNfts as OwnedNFT[]
  }).catch((err) => {
    console.log('error: ', err)
    return []
  })
}

const filterNFTsWithAlchemy = (
  contractChunks: string[],
  owner: string,
): Promise<void[]> => {
  let url = `${ALCHEMY_API_URL}/getNFTs/?owner=${owner}`
  contractChunks.map((contract: string) => {
    url = url.concat(`&contractAddresses%5B%5D=${contract}`)
  })
  return axios.get(url).then((result) => {
    const ownedNfts = result.data.ownedNfts
    // check if user's NFTs are on his/her hand ...
    return Promise.all(
      contractChunks.map((contract) => {
        const index = ownedNfts.findIndex((nft) => nft.contract.address === contract)
        // if contract owner has changed ...
        if (index === -1)
          repositories.nft.delete({ contract: contract })
      }),
    )
  }).catch((err) => {
    console.log('error: ', err)
    return []
  })
}

const getNFTMetaDataFromAlchemy = (
  contractAddress: string,
  tokenId: string,
): Promise<NFTMetaDataResponse | undefined> => {
  const url = `${ALCHEMY_API_URL}/getNFTMetadata?contractAddress=${contractAddress}&tokenId=${tokenId}`
  return axios.get(url).then((result) => {
    return result.data as NFTMetaDataResponse
  }).catch((err) => {
    console.log('error: ', err)
    return undefined
  })
}

const updateEntity = (
  nftInfo: NFTMetaDataResponse,
  userId: string,
  walletId: string,
): Promise<void> => {
  return repositories.nft.findOne({ where: { contract: nftInfo.contract.address } })
    .then((existingNFT) => {
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
        repositories.nft.save({
          contract: nftInfo.contract.address,
          metadata: {
            name: nftInfo.metadata.name,
            description: nftInfo.metadata.description,
            tokenId: nftInfo.id.tokenId,
            imageURL: nftInfo.media.uri,
            traits: traits,
          },
          type: type,
          userId: userId,
          walletId: walletId,
        })
      }
    })
}

const checkNFTContractAddresses = (
  userId: string,
  walletId: string,
  walletAddress: string,
): Promise<void[]> => {
  const contractAddresses = []
  return repositories.nft.find({ where: { userId: userId, walletId: walletId } })
    .then((nfts: entity.NFT[]) => {
      nfts.map((nft: entity.NFT) => {
        contractAddresses.push(nft.contract)
      })
      if (!contractAddresses.length) return []
      const contractsChunks = Lodash.chunk(contractAddresses, 20)
      return Promise.all(
        contractsChunks.map((contracts: string[]) => {
          return filterNFTsWithAlchemy(contracts, walletAddress)
        }),
      )
    }).catch((err) => {
      console.log('error: ', err)
      return []
    })
}

/**
 * check if NFTs of users are sold or transferred to different address...
 * @param users
 */
const checkOwnedNFTs = (users: entity.User[]): Promise<void[]> => {
  return Promise.all(
    users.map((user: entity.User) => {
      repositories.wallet.findByUserId(user.id)
        .then((wallets: entity.Wallet[]) => {
          return Promise.all(
            wallets.map((wallet: entity.Wallet) => {
              checkNFTContractAddresses(user.id, wallet.id, wallet.address)
            }),
          )
        })
    }),
  )
}

/**
 * get owned NFTs of users...
 * @param users
 */
const getOwnedNFTs = (users: entity.User[]): Promise<void[]> => {
  return Promise.all(
    users.map((user: entity.User) => {
      repositories.wallet.findByUserId(user.id)
        .then((wallets: entity.Wallet[]) => {
          return Promise.all(
            wallets.map((wallet: entity.Wallet) => {
              getNFTsFromAlchemy(wallet.address)
                .then((ownedNFTs: OwnedNFT[]) => {
                  return Promise.all(
                    ownedNFTs.map((nft: OwnedNFT) => {
                      getNFTMetaDataFromAlchemy(nft.contract.address, nft.id.tokenId)
                        .then((response) => {
                          if (response)
                            updateEntity(
                              response,
                              user.id,
                              wallet.id,
                            )
                        })
                    }),
                  )
                })
            }),
          )
        })
    }),
  )
}

export const getUsersNFTs = (job: Job): Promise<any> => {
  console.log('getUsersNFTs: ', job)
  try {
    return repositories.user.findAll().then((users: entity.User[]) => {
      checkOwnedNFTs(users).then(() => {
        getOwnedNFTs(users)
      })
    })
  } catch (err) {
    console.log('error: ', err)
  }
}
