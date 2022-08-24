export enum ErrorType {
  ActivityNotSet = 'ACTIVITY_NOT_SENT',
  ActivityIncorrect = 'ACTIVITY_INCORRECT',
  NoActivityToUpdate = 'NO_ACTIVITY_TO_UPDATE',
  TokenWithNoContract = 'TOKEN_NO_CONTRACT',
  CollectionNotSupported = 'COLLECTION_NOT_SUPPORTED',
  NullInput = 'NullInput'
}

export const buildNoActivityId = (): string => 'No Activity Ids Sent'

export const buildIncorrectActivity = (activity: string): string => `Activity ${activity} is incorrect`

export const buildNoActivitiesToUpdate = (): string => 'Activities are not owned by wallet or are already read'

export const buildTokenWithNoContract = (): string => 'Token Id is sent without any contract'

export const buildCollectionNotSupported = (): string => 'Collection queries are not supported'

export const buildNullInput = (): string => 'Input cannot be null'
