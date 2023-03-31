type BasicToken = {
  address: string
  decimals: number
  name?: string
  symbol?: string
}

export const basicCoins: BasicToken[] = [
  // ETH
  {
    address: '0x0000000000000000000000000000000000000000',
    decimals: 18,
    name: 'ETH',
    symbol: 'ETH',
  },
  // WETH
  {
    address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    decimals: 18,
    name: 'WETH',
    symbol: 'WETH',
  },
  // USDC
  {
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    decimals: 6,
    name: 'USDC',
    symbol: 'USDC',
  },
]
