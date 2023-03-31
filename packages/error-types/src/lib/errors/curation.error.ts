export enum ErrorType {
  CurationNotFound = 'CURATION_NOT_FOUND',
  CurationNotOwned = 'CURATION_NOT_FOUND',
}

export const buildCurationNotFoundMsg = (id: string): string => `Curation ${id} not found`

export const buildCurationNotOwnedMsg = (): string => 'Curation not owned by user'
