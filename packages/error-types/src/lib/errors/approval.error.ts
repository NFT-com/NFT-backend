export enum ErrorType {
  ApprovalNotFound = 'APPROVAL_NOT_FOUND',
  ApprovalInsufficient = 'APPROVAL_INSUFFICIENT',
}

export const buildApprovalNotFoundMsg = (): string => 'Approval not found'

export const buildApprovalInsufficientMsg = (): string => 'Approval too small'
