export type Chain = {
  id: string
  name: string
}

export type Network = {
  [key: string]: Chain[]
}

export const LARGE_COLLECTIONS = [
  '0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85', // ENS
  '0x06012c8cf97BEaD5deAe237070F9587f8E7A266d', // CryptoKitties
  '0xD1E5b0FF1287aA9f9A268759062E4Ab08b9Dacbe', // UD
  '0x495f947276749Ce646f68AC8c248420045cb7b5e', // OpenSea Shared Storefront
  '0x3B3ee1931Dc30C1957379FAc9aba94D1C48a5405', // Foundation (FND)
]

export const GK_EXPIRATION_YEAR = 3021
