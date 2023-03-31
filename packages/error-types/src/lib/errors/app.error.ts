import { ApolloError } from 'apollo-server-express'

import { HTTP } from './http.code'

enum ErrorType {
  InternalError = 'INTERNAL_ERROR',
  InvalidSchema = 'INVALID_SCHEMA',
  Forbidden = 'FORBIDDEN',
}

export const buildCustom = (message: string): ApolloError =>
  new ApolloError(message, HTTP.ServerError, { errorKey: ErrorType.InternalError })

export const buildInternal = (): ApolloError =>
  new ApolloError('Internal server error', HTTP.ServerError, { errorKey: ErrorType.InternalError })

export const buildInvalidSchema = (error: Error): ApolloError =>
  new ApolloError(`Invalid schema provided: ${error}`, HTTP.BadRequest, { errorKey: ErrorType.InvalidSchema })

export const buildNotFound = (message: string, errorKey: string): ApolloError =>
  new ApolloError(message, HTTP.NotFound, { errorKey })

export const buildExists = (message: string, errorKey: string): ApolloError =>
  new ApolloError(message, HTTP.Conflict, { errorKey })

export const buildInvalid = (message: string, errorKey: string): ApolloError =>
  new ApolloError(message, HTTP.BadRequest, { errorKey })

export const buildForbidden = (message: string, errorKey: string = ErrorType.Forbidden): ApolloError =>
  new ApolloError(message, HTTP.Forbidden, { errorKey })
