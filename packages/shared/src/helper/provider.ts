import { ethers, providers } from 'ethers'

import { _logger } from '../helper'

const logger = _logger.Factory(_logger.Context.General)

export const provider = (
  chainId: providers.Networkish = 1, //mainnet default
): ethers.providers.BaseProvider => {
  const ALCHEMY_API_URL = Number(chainId) == 1 ? (process.env.ALCHEMY_API_URL).replace('https://eth-mainnet.alchemyapi.io/v2/', '') :
    Number(chainId) == 5 ? (process.env.ALCHEMY_API_URL_GOERLI).replace('https://eth-goerli.g.alchemy.com/v2/', '') : (process.env.ALCHEMY_API_URL_RINKEBY).replace('https://eth-rinkeby.alchemyapi.io/v2/', '')

  logger.info('*** process.env.ALCHEMY_API_URL: ', process.env.ALCHEMY_API_URL)
  logger.info('*** process.env.ALCHEMY_API_URL_RINKEBY: ', process.env.ALCHEMY_API_URL_RINKEBY)
  logger.info('*** process.env.ALCHEMY_API_URL_GOERLI: ', process.env.ALCHEMY_API_URL_GOERLI)
  logger.info('*** ALCHEMY_API_URL: ', ALCHEMY_API_URL)
  return new ethers.providers.AlchemyProvider(chainId, ALCHEMY_API_URL)
}