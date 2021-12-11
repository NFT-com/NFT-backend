import { ApolloError } from 'apollo-server'

import { HTTP } from './http.code'

export enum ErrorType {
  AuthenticationRequired = 'AUTHENTICATION_REQUIRED',
  UserNotFound = 'USER_NOT_FOUND',
  EmailAlreadyExists = 'EMAIL_ALREADY_EXISTS',
  EmailConfirmTokenRequired = 'EMAIL_CONFIRM_TOKEN_REQUIRED',
  InvalidEmailConfirmToken = 'INVALID_EMAIL_CONFIRM_TOKEN',
  ForbiddenAction = 'FORBIDDEN_ACTION',
}

export const buildAuth = (): ApolloError =>
  new ApolloError(
    'You must be signed in',
    HTTP.Unauthorized,
    { errorKey: ErrorType.AuthenticationRequired },
  )

export const buildUserNotFoundMsg = (id: string): string => `User ${id} not found`

export const buildEmailExistsMsg = (email: string): string =>
  `User with email ${email} already exists`

export const buildEmailTokenRequiredMsg = (): string => 'Email confirm token is required'

export const buildInvalidEmailTokenMsg = (token: string): string =>
  `Email confirm token ${token} is invalid`

export const buildForbiddenActionMsg = (): string => 'You  may not perform this action.'