import { ApolloError } from 'apollo-server-express'

import { HTTP } from './http.code'

export enum ErrorType {
  AuthenticationRequired = 'AUTHENTICATION_REQUIRED',
  UserNotFound = 'USER_NOT_FOUND',
  EmailAlreadyExists = 'EMAIL_ALREADY_EXISTS',
  UsernameAlreadyExists = 'USERNAME_ALREADY_EXISTS',
  EmailConfirmTokenRequired = 'EMAIL_CONFIRM_TOKEN_REQUIRED',
  InvalidEmailConfirmToken = 'INVALID_EMAIL_CONFIRM_TOKEN',
  ForbiddenAction = 'FORBIDDEN_ACTION',
  EventAction = 'EVENT_NOT_FOUND',
  InvalidReferralId = 'INVALID_REFERRAL_ID',
  AuthenticationExpired = 'AUTHENTICATION_EXPIRED',
}

export const buildAuth = (): ApolloError =>
  new ApolloError(
    'You must be signed in',
    HTTP.Unauthorized,
    { errorKey: ErrorType.AuthenticationRequired },
  )

export const buildAuthExpired = (): ApolloError =>
  new ApolloError(
    'Authentication header is expired',
    HTTP.Unauthorized,
    { errorKey: ErrorType.AuthenticationExpired },
  )

export const buildAuthOutOfExpireDuration = (): ApolloError =>
  new ApolloError(
    'Expire duration of Authentication is out of expiry limit',
    HTTP.Unauthorized,
    { errorKey: ErrorType.AuthenticationExpired },
  )

export const buildUserNotFoundMsg = (id: string): string => `User ${id} not found`

export const buildUsernameExistsMsg = (username: string): string =>
  `User with username ${username} already exists`

export const buildEmailExistsMsg = (email: string): string =>
  `User with email ${email} already exists`

export const buildEmailTokenRequiredMsg = (): string => 'Email confirm token is required'

export const buildInvalidEmailTokenMsg = (token: string): string =>
  `Email confirm token ${token} is invalid`

export const buildEventNotFoundMsg = (id: string): string =>
  id

export const buildForbiddenActionMsg = (id = ''): string => 'You may not perform this action.' + id

export const buildInvalidReferralId = (referralId: string): string =>
  `Referral Id ${referralId} is invalid`
