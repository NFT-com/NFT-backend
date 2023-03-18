import { ethers, providers } from 'ethers'

import { _logger } from '../helper'

const logger = _logger.Factory('provider', _logger.Context.WebsocketProvider)

export const provider = (
  chainId: providers.Networkish = 1, //mainnet default
  infura?: boolean,
): ethers.providers.BaseProvider => {
  if (infura) { // dedicated key
    return new ethers.providers.InfuraProvider(chainId, process.env.INFURA_API_KEY)
  } else if (process.env.USE_ZMOK == 'true' && Number(chainId) == 1) { // zmok only has support for mainnet and rinkeby (feb 2023)
    logger.info('Using zmok provider')
    return new ethers.providers.JsonRpcProvider(`https://api.zmok.io/mainnet/${process.env.ZMOK_API_KEY}`)
  } else if (process.env.USE_INFURA == 'true') {
    logger.info('Using infura provider')
    const items = process.env.INFURA_KEY_SET.split(',')
    const randomKey = items[Math.floor(Math.random() * items.length)]
    return new ethers.providers.InfuraProvider(chainId, randomKey)
  } else {
    logger.info('Using alchemy provider')
    return new ethers.providers.AlchemyProvider(chainId, process.env.ALCHEMY_API_KEY)
  }
}