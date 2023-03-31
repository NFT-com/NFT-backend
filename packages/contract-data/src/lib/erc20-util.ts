import { Contract } from 'ethers'

import { cache } from '@nftcom/cache'
import { _logger, provider, typechain } from '@nftcom/shared'

const logger = _logger.Factory('ERC20-Util', _logger.Context.GraphQL)

export const getSymbolForContract = async (contractAddress: string): Promise<string> => {
  if (!contractAddress || contractAddress === '0x0000000000000000000000000000000000000000') return 'ETH'
  const key = `ERC20_SYMBOL_${contractAddress}`
  let symbol = await cache.get(key)
  if (!symbol) {
    const contract = new Contract(
      contractAddress,
      typechain.ERC20Metadata__factory.abi,
      provider.provider(),
    ) as unknown as typechain.ERC20Metadata
    try {
      symbol = await contract.symbol()
    } catch (e) {
      symbol = 'UNKNOWN'
      logger.error(e, `Symbol not found for ${contractAddress}`)
    }
    cache.set(key, symbol)
  }
  return symbol
}

export const getDecimalsForContract = async (contractAddress: string): Promise<number> => {
  if (!contractAddress || contractAddress === '0x0000000000000000000000000000000000000000') return 18
  const key = `ERC20_DECIMALS_${contractAddress}`
  let decimals = parseInt(await cache.get(key))
  if (isNaN(decimals)) {
    const contract = new Contract(
      contractAddress,
      typechain.ERC20Metadata__factory.abi,
      provider.provider(),
    ) as unknown as typechain.ERC20Metadata
    try {
      decimals = await contract.decimals()
    } catch (e) {
      decimals = 18
      logger.error(e, `Decimals not found for ${contractAddress}`)
    }
    cache.set(key, decimals)
  }
  return decimals
}
