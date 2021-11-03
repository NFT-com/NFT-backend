export type Chain = {
  id: string
  name: string
}

export type Network = {
  [key: string]: Chain[]
}

export enum EntityType {
  Approval = 'Approval',
  Bid = 'Bid',
  Edge = 'Edge',
  NFT = 'NFT',
  Profile = 'Profile',
  User = 'User',
  Wallet = 'Wallet'
}

export enum EdgeType {
  Follows = 'Follows',
}
