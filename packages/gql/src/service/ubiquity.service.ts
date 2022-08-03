import axios from 'axios'
import { ethers } from 'ethers'

import { cache } from '@nftcom/gql/service/cache.service'

interface UbiquityNftCollection {
  'collection': {
    'id': string
    'name': string
    'description': string
    'logo': string
    'banner': string
    'verified': boolean
    'contracts': Array<{
      'address': string
      'name': string
      'symbol': string
      'description': string
      'image_url': string
      'type': string
    }>
    'meta': {
      'discord_url': string
      'external_url': string
      'twitter_username': string
    }
  }
}

export const getUbiquity = async (
  contractAddress: string,
  chainId: string,
): Promise<UbiquityNftCollection> => {
  try {
    const key = `getUbiquity-${ethers.utils.getAddress(contractAddress)}-${chainId}`
    if (await cache.get(key)) {
      return JSON.parse(await cache.get(key))
    } else {
      const network = chainId == '1' ? 'mainnet' :
        chainId == '5' ? 'goerli' :
          chainId == '4' ? 'rinkeby' : 'mainnet'
      const baseNftUrl = 'https://ubiquity.api.blockdaemon.com/v1/nft'
      const url = `${baseNftUrl}/ethereum/${network}/collection?contract_address=${ethers.utils.getAddress(contractAddress)}`
      const config = {
        headers: { Accept: 'application/json', Authorization: `Bearer ${process.env.UBIQUITY_API_KEY}` },
      }

      const result = await axios.get(url, config)

      await cache.set(key, JSON.stringify(result.data))

      return result.data
    }
  } catch (err) {
    console.log('error getting ubiquity: ', err)
  }
}