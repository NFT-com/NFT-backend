import { GraphQLError } from 'graphql'

import { HTTP } from './http.code'

enum ErrorType {
  InternalError = 'INTERNAL_ERROR',
  InvalidSchema = 'INVALID_SCHEMA',
  Forbidden = 'FORBIDDEN'
}

export const buildCustom = (message: string): GraphQLError =>
  new GraphQLError(
    message,
    {
      extensions: {
        code: HTTP.ServerError,
        errorKey: ErrorType.InternalError,
      },
    },
  )

export const buildInternal = (): GraphQLError =>
  new GraphQLError(
    'Internal server error',
    {
      extensions: {
        code: HTTP.ServerError,
        errorKey: ErrorType.InternalError,
      },
    },
  )

export const buildInvalidSchema = (error: Error): GraphQLError =>
  new GraphQLError(
    `Invalid schema provided: ${error}`,
    {
      extensions: {
        code: HTTP.BadRequest,
        errorKey: ErrorType.InvalidSchema,
      },
    },
  )

export const buildNotFound = (message: string, errorKey: string): GraphQLError =>
  new GraphQLError(
    message,
    {
      extensions: {
        code: HTTP.NotFound,
        errorKey,
      },
    },
  )

export const buildExists = (message: string, errorKey: string): GraphQLError =>
  new GraphQLError(
    message,
    {
      extensions: {
        code: HTTP.Conflict,
        errorKey,
      },
    },
  )

export const buildInvalid = (message: string, errorKey: string): GraphQLError =>
  new GraphQLError(
    message,
    {
      extensions: {
        code: HTTP.BadRequest,
        errorKey,
      },
    },
  )

export const buildForbidden = (
  message: string,
  errorKey: string = ErrorType.Forbidden,
): GraphQLError =>
  new GraphQLError(
    message,
    {
      extensions: {
        code: HTTP.Forbidden,
        errorKey,
      },
    },
  )
