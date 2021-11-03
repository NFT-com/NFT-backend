import { ApolloError } from 'apollo-server'

import { HTTP } from './http.code'

enum ErrorType {
  InternalError = 'INTERNAL_ERROR',
  InvalidSchema = 'INVALID_SCHEMA',
}

export const buildCustomError = (message: string): ApolloError =>
  new ApolloError(
    message,
    HTTP.ServerError,
  { errorKey: ErrorType.InternalError },
  )

export const buildInternalError = (): ApolloError =>
  new ApolloError(
    'Internal server error',
    HTTP.ServerError,
  { errorKey: ErrorType.InternalError },
  )

export const buildInvalidSchemaError = (error: Error): ApolloError =>
  new ApolloError(
    `Invalid schema provided: ${error}`,
    HTTP.BadRequest,
  { errorKey: ErrorType.InvalidSchema },
  )
