import { ethers, providers } from 'ethers'

export const provider = (
  chainId: providers.Networkish = 1, //mainnet default
): ethers.providers.BaseProvider => {
  return new ethers.providers.JsonRpcProvider(process.env.ZMOK_API_URL, chainId)
}
