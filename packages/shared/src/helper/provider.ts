import { ethers, providers } from 'ethers'

export const provider = (
  chainId: providers.Networkish = 1, //mainnet default
): ethers.providers.BaseProvider => {
  return new ethers.providers.FallbackProvider([
    // using zmok exclusively, can add additional providers if needed (need paid subscription)
    // https://docs.ethers.io/v5/api/providers/other/#FallbackProvider
    {
      priority: 1,
      weight: 1,
      provider: new ethers.providers.JsonRpcProvider(process.env.ZMOK_API_URL, chainId),
    },
  ],1)
}