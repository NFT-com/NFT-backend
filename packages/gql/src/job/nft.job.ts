import axios from 'axios'
import { Job } from 'bull'

import { db, entity } from '@nftcom/shared'
import { NFTType } from '@nftcom/shared/defs'

const repositories = db.newRepositories()
const ALCHEMY_API_KEY = 'wihsxPwWsaTUgmL3ejTNHGHbhDrI3Yvh'
const ALCHEMY_API_URL = `https://eth-mainnet.g.alchemy.com/${ALCHEMY_API_KEY}/v1`

interface OwnedNFT {
  contract: {
    address: string
  }
  id: {
    tokenId: string
  }
}
interface OwnedNFTsResponse {
  ownedNfts: OwnedNFT[]
  pageKey: string
  totalCount: number
  blockHash: string
}
interface AlternateMedia {
  uri: string
}
interface Attribute {
  trait_type: string
  value: string
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
    image: string
    attributes: Attribute[]
  }
  timeLastUpdated: string
}

const getNFTsFromAlchemy = (owner: string): Promise<OwnedNFT[]> => {
  const url = `${ALCHEMY_API_URL}/getNFTs/?owner=${owner}`
  return axios.get<OwnedNFTsResponse>(url).then((result) => {
    return result.data.ownedNfts as OwnedNFT[]
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
  return axios.get<NFTMetaDataResponse>(url).then((result) => {
    return result
  }).catch((err) => {
    console.log('error: ', err)
    return undefined
  })
}

const updateEntity = (
  nftInfo: NFTMetaDataResponse,
  profileId: string,
  userId: string,
  walletId: string,
): Promise<void> => {
  return repositories.nft.findOne({ where: { contract: nftInfo.contract.address } })
    .then((existingNFT) => {
      // if this NFT is not existing on the NFT table, we save nft information...
      if (!existingNFT) {
        let type
        if (nftInfo.id.tokenMetadata.tokenType === 'ERC721') {
          type = NFTType.ERC721
        } else if (nftInfo.id.tokenMetadata.tokenType === 'ERC1155') {
          type = NFTType.ERC1155
        }
        repositories.nft.save({
          contract: nftInfo.contract.address,
          metadata: {
            tokenId: nftInfo.id.tokenId,
            imageURL: nftInfo.media.uri,
          },
          profileId: profileId,
          type: type,
          userId: userId,
          walletId: walletId,
        })
      }
    })
}

const checkNFTContractAddresses = (profileId: string, owner: string): Promise<void[]> => {
  const url = `${ALCHEMY_API_URL}/getNFTs/?owner=${owner}`
  const contractAddresses = []
  repositories.nft.find({ where: { profileId: profileId } })
    .then((nfts: entity.NFT[]) => {
      nfts.map((nft: entity.NFT) => {
        contractAddresses.push(nft.contract)
        url.concat(`&contractAddresses%5B%5D=${nft.contract}`)
      })
    })
  return axios.get<OwnedNFTsResponse>(url).then((result) => {
    const ownedNfts = result.data.ownedNfts
    // check if user's NFTs are on his/her hand ...
    return Promise.all(
      contractAddresses.map((contract) => {
        const index = ownedNfts.findIndex((nft) => nft.contract.address === contract)
        if (index === -1)
          repositories.nft.delete({ contract: contract })
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
      repositories.profile.findByOwner(user.id)
        .then((profiles: entity.Profile[]) => {
          return Promise.all(
            profiles.map((profile: entity.Profile) => {
              repositories.wallet.findById(profile.ownerWalletId)
                .then((wallet: entity.Wallet) => {
                  checkNFTContractAddresses(profile.id, wallet.address)
                })
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
      repositories.profile.findByOwner(user.id)
        .then((profiles: entity.Profile[]) => {
          return Promise.all(
            profiles.map((profile: entity.Profile) => {
              repositories.wallet.findById(profile.ownerWalletId)
                .then((wallet: entity.Wallet) => {
                  getNFTsFromAlchemy(wallet.address)
                    .then((ownedNFTs: OwnedNFT[]) => {
                      return Promise.all(
                        ownedNFTs.map((nft: OwnedNFT) => {
                          getNFTMetaDataFromAlchemy(nft.contract.address, nft.id.tokenId)
                            .then((response) => {
                              if (response)
                                updateEntity(
                                  response,
                                  profile.id,
                                  profile.ownerUserId,
                                  wallet.address,
                                )
                            })
                        }),
                      )
                    })
                })
            }),
          )
        })
    }),
  )
}

export const getUsersNFTs = (job: Job): Promise<any> => {
  console.log(job)
  try {
    return repositories.user.findAll().then((users: entity.User[]) => Promise.all([
      checkOwnedNFTs(users),
      getOwnedNFTs(users),
    ]))
  } catch (err) {
    console.log('error: ', err)
  }
}
