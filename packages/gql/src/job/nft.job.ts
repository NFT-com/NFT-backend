import axios from 'axios'
import { Job } from 'bull'

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
      // if this NFT is not existing on the NFT table, we save nft information
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

/**
 * check if NFTs of users are sold or transferred to different address
 * @param users
 */
// const checkOwnedNFTs = (users: entity.User[]): Promise<void> => {
//   return
// }

/**
 * get owned NFTs of users
 * @param users
 */
const getOwnedNFTs = (users: entity.User[]): Promise<void[]> => {
  return Promise.all(
    users.map((user: entity.User) => {
      repositories.profile.findByOwner(user.id)
        .then((profiles: entity.Profile[]) => {
          return Promise.all(
            profiles.map((profile: entity.Profile) => {
              getNFTsFromAlchemy(profile.ownerWalletId)
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
                              profile.ownerWalletId,
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
  console.log(job)
  try {
    return repositories.user.findAll().then((users: entity.User[]) => Promise.all([
      //checkOwnedNFTs(users),
      getOwnedNFTs(users),
    ]))
  } catch (err) {
    console.log('error: ', err)
  }
}
