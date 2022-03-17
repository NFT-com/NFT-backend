import { ethers, providers } from 'ethers'

export const provider = (
  chainId: providers.Networkish = 4, /* mainnet */
): ethers.providers.BaseProvider => {
  return new ethers.providers.FallbackProvider([
    // lower value prio picked first 
    // weight decides quorum - 50% for successful response
    {
      priority: 1,
      weight: 2,
      provider: new ethers.providers.AlchemyProvider(chainId, process.env.ALCHEMY_API_KEY),
    },
    {
      priority: 1,
      weight: 2,
      provider: new ethers.providers.InfuraProvider(chainId, process.env.INFURA_API_KEY),
    },
    {
      priority: 2,
      weight: 1,
      provider: new ethers.providers.JsonRpcProvider(process.env.ZMOK_API_URL,chainId),
    },
  ])
}