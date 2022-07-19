import { ethers, providers } from 'ethers'

export const provider = (
  chainId: providers.Networkish = 1, //mainnet default
): ethers.providers.BaseProvider => {
  const ALCHEMY_API_URL = Number(chainId) == 1 ? (process.env.ALCHEMY_API_URL).replace('https://eth-mainnet.alchemyapi.io/v2/', '') :
    Number(chainId) == 5 ? (process.env.ALCHEMY_API_URL_GOERLI).replace('https://eth-goerli.g.alchemy.com/v2/', '') : (process.env.ALCHEMY_API_URL_RINKEBY).replace('https://eth-rinkeby.alchemyapi.io/v2/', '')

  console.log('*** process.env.ALCHEMY_API_URL: ', process.env.ALCHEMY_API_URL)
  console.log('*** process.env.ALCHEMY_API_URL_RINKEBY: ', process.env.ALCHEMY_API_URL_RINKEBY)
  console.log('*** process.env.ALCHEMY_API_URL_GOERLI: ', process.env.ALCHEMY_API_URL_GOERLI)
  console.log('*** ALCHEMY_API_URL: ', ALCHEMY_API_URL)
  return new ethers.providers.AlchemyProvider(chainId, ALCHEMY_API_URL)
}