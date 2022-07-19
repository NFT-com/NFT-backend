import { BigNumber } from 'ethers'

import {
  BaseEntity,
  Collection,
  Profile,
  Wallet,
} from '@nftcom/shared/db/entity'

import { NFTDao } from './model'

export const collectionNames = ['collections', 'nfts', 'profiles', 'wallets']

const getRandomFloat = (min, max, decimals): number => {
  const str = (Math.random() * (max - min) + min).toFixed(decimals)

  return parseFloat(str)
}

export const mapCollectionData = (
  collectionName: string,
  data: any[],
): BaseEntity[] => {
  let result: any[]
  switch (collectionName) {
  case 'collections':
    result = data.map((collection: Collection) => {
      return {
        id: collection.id,
        contractAddr: collection.contract,
        contractName: collection.name,
        chain: '',
        description: '',
        floor: getRandomFloat(0, 200, 2),
      }
    })
    break
  case 'nfts':
    result = data.map((nft: NFTDao) => {
      const traits = nft.metadata.traits.reduce((traitObj, trait) => {
        return {
          ...traitObj,
          [`traits.${trait.type}`]: trait.value.toString(),
        }
      }, {})
      console.log('traits', traits)
      return {
        id: nft.id,
        contractAddr: nft.contract,
        tokenId: BigNumber.from(nft.tokenId).toString(),
        nftName: nft.metadata.name,
        nftType: nft.type,
        nftDescription: nft.metadata.description,
        listingType: '',
        chain: nft.wallet.chainName,
        ownerAddr: nft.walletId,
        status: '',
        contractName: nft.collection?.name || '',
        imageURL: nft.metadata.imageURL,
        listedPx: getRandomFloat(0.3, 500, 2),
        lastSoldPx: getRandomFloat(0.01, 400, 2),
        currency: '',
        nftCreateDate: '',
        lastListPx: getRandomFloat(0.01, 300, 2),
        lastListDate: '',
        ...traits,
      }
    })
    break
  case 'profiles':
    result = data.map((profile: Profile) => {
      return {
        id: profile.id,
        url: profile.url,
      }
    })
    break
  case 'wallets':
    result = data.map((wallet: Wallet) => {
      return {
        id: wallet.id,
        chain: wallet.network,
        address: wallet.address,
      }
    })
    break
  default:
    break
  }
  return result
}
