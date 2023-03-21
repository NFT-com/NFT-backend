export enum ErrorType {
  CollectionNotFound = 'COLLECTION_NOT_FOUND',
}

export const buildCollectionNotFoundMsg = (id: string): string => `Collection ${id} not found`
