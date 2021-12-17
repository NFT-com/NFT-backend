export enum ErrorType {
  NFTNotFound = 'NFT_NOT_FOUND',
  NFTNotOwned = 'NFT_NOT_FOUND'
}
    
export const buildNFTNotFoundMsg = (id: string): string => `NFT ${id} not found`
  
export const buildNFTNotOwnedMsg = (): string => 'NFT not owned by user'
    