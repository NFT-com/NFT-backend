import { GraphQLError } from 'graphql'

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
}

export const buildAuth = (): GraphQLError =>
  new GraphQLError(
    'You must be signed in',
    {
      extensions: {
        code: HTTP.Unauthorized,
        errorKey: ErrorType.AuthenticationRequired,
      },
    },
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