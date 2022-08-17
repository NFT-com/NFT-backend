export enum ErrorType {
  ActivityNotSet = 'ACTIVITY_NOT_SENT',
  NoActivityToUpdate = 'NO_ACTIVITY_TO_UPDATE',
  NFTNotOwned = 'NFT_NOT_FOUND',
  MemoTooLong = 'MEMO_TOO_LONG'
}

export const buildNoActivityId = (): string => 'No Activity Ids Sent'

export const buildNoActivitiesToUpdate = (): string => 'Activities are not owned by wallet or are already read'