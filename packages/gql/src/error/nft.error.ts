export enum ErrorType {
  NFTNotFound = 'NFT_NOT_FOUND',
  NFTNotOwned = 'NFT_NOT_FOUND',
  MemoTooLong = 'MEMO_TOO_LONG'
}

export const buildNFTNotFoundMsg = (id: string): string => `NFT ${id} not found`

export const buildNFTNotOwnedMsg = (): string => 'NFT not owned by user'

export const buildMemoTooLong = (): string => 'Length of memo can not exceed 2000'
