export enum ErrorType {
  NFTNotFound = 'NFT_NOT_FOUND',
  NFTNotOwned = 'NFT_NOT_FOUND',
  MemoTooLong = 'MEMO_TOO_LONG',
  NFTNotValid = 'NFT_NOT_VALID',
}

export const buildNFTNotFoundMsg = (id: string): string => `NFT ${id} not found`

export const buildNFTNotOwnedMsg = (): string => 'NFT not owned by user'

export const buildProfileNotOwnedMsg = (url: string, userId: string): string =>
  `NFT.com profile ${url} not owned by user ${userId}`

export const buildMemoTooLong = (): string => 'Length of memo can not exceed 2000'
export const buildNFTNotValid = (): string => 'This NFT is not valid'
