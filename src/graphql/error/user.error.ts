import { ApolloError } from 'apollo-server'

import { HTTP } from './http.code'

enum ErrorType {
  AuthenticationRequired = 'AUTHENTICATION_REQUIRED',
  UserNotFound = 'USER_NOT_FOUND',
  EmailAlreadyExists = 'EMAIL_ALREADY_EXISTS',
  EmailConfirmTokenRequired = 'EMAIL_CONFIRM_TOKEN_REQUIRED',
  InvalidEmailConfirmToken = 'INVALID_EMAIL_CONFIRM_TOKEN',
}

export const buildAuthError = (): ApolloError =>
  new ApolloError(
    'You must be signed in',
    HTTP.Unauthorized,
    { errorKey: ErrorType.AuthenticationRequired },
  )

export const buildUserNotFound = (): ApolloError =>
  new ApolloError(
    'User not found',
    HTTP.NotFound,
    { errorKey: ErrorType.UserNotFound },
  )

export const buildEmailAlreadyExistsError = (email: string): ApolloError =>
  new ApolloError(
    `User with email ${email} already exists`,
    HTTP.Conflict,
  { errorKey: ErrorType.EmailAlreadyExists },
  )

export const buildEmailConfirmTokenRequiredError = (): ApolloError =>
  new ApolloError(
    'Email confirm token is required',
    HTTP.BadRequest,
  { errorKey: ErrorType.EmailConfirmTokenRequired },
  )

export const buildInvalidEmailConfirmTokenError = (token: number): ApolloError =>
  new ApolloError(
    `Email confirm token ${token} is invalid`,
    HTTP.BadRequest,
  { errorKey: ErrorType.InvalidEmailConfirmToken },
  )
