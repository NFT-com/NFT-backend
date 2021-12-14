import profileAuctionABIJSON from '@nftcom/shared/helper/abis/profile_auction.json'

export function nftTokenAddress(chainId: string | number = 'mainnet'): string {
  switch (chainId) {
  case 4:
  case '4':
  case 'rinkeby':
    return '0x4DE2fE09Bc8F2145fE12e278641d2c93B9D4393A'
  case '0':
  case 0:
  case 'mainnet':
  default:
    return '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
  }
}

export function profileAuctionAddress(chainId: string | number = 'mainnet'): string {
  switch (chainId) {
  case '4':
  case 'rinkeby':
  case 4:
    return '0x0684cb6f6dF529135E591b1F15028b57185d3195'
  case '0':
  case 0:
  case 'mainnet':
    return '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
  }
}

export function profileAuctionABI(): any {
  return profileAuctionABIJSON
}