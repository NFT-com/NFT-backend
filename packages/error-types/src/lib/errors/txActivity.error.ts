export enum ErrorType {
  ActivityNotSet = 'ACTIVITY_NOT_SENT',
  ActivityIncorrect = 'ACTIVITY_INCORRECT',
  StatusIncorrect = 'STATUS_INCORRECT',
  StatusNotAllowed = 'STATUS_NOT_ALLOWED',
  NoActivityToUpdate = 'NO_ACTIVITY_TO_UPDATE',
  TokenWithNoContract = 'TOKEN_NO_CONTRACT',
  CollectionNotSupported = 'COLLECTION_NOT_SUPPORTED',
  NullInput = 'NullInput',
  OpenSea = 'OPENSEA_ERROR',
  LooksRare = 'LOOKSRARE_ERROR',
}

export const buildNoActivityId = (): string => 'No Activity Ids Sent'

export const buildIncorrectActivity = (activity: string): string => `Activity ${activity} is incorrect`

export const buildIncorrectStatus = (status: string): string => `Status ${status} is incorrect`

export const buildStatusNotAllowed = (status: string): string => `Status ${status} is not allowed for this operation`

export const buildNoActivitiesReadToUpdate = (): string => 'Activities are not owned by wallet or are already read'

export const buildNoActivitiesStatusToUpdate = (): string => 'Activities are not owned by wallet'

export const buildTokenWithNoContract = (): string => 'Token Id is sent without any contract'

export const buildCollectionNotSupported = (): string => 'Collection queries are not supported'

export const buildNullInput = (): string => 'Input cannot be null'

export const buildOpenSea = (err: Error): string => `OpenSea ${err}`

export const buildLooksRare = (err: Error): string => `LooksRare ${err}`
