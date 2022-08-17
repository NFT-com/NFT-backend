import axios from 'axios'
import { ethers } from 'ethers'

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
): Promise<UbiquityNftCollection | undefined> => {
  try {
    const network = chainId == '1' ? 'mainnet' :
      chainId == '5' ? 'goerli' :
        chainId == '4' ? 'rinkeby' : 'mainnet'
    const baseNftUrl = 'https://ubiquity.api.blockdaemon.com/v1/nft'
    const url = `${baseNftUrl}/ethereum/${network}/collection?contract_address=${ethers.utils.getAddress(contractAddress)}`
    const config = {
      headers: { Accept: 'application/json', Authorization: `Bearer ${process.env.UBIQUITY_API_KEY}` },
    }

    const result = await axios.get(url, config)
    if (result.data) {
      return result.data
    } else {
      return undefined
    }
  } catch (err) {
    console.log('error getting ubiquity: ', err)
    return undefined
  }
}
