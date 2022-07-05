import { ethers, providers } from 'ethers'

export const provider = (
  chainId: providers.Networkish = 1, //mainnet default
): ethers.providers.BaseProvider => {
  return new ethers.providers.AlchemyProvider(chainId, process.env.ALCHEMY_API_KEY)
}
