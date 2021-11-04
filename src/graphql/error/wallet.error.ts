import { ApolloError } from 'apollo-server'

import { Chain } from '@src/defs'

import { HTTP } from './http.code'

export enum ErrorType {
  InvalidNetwork = 'INVALID_NETWORK',
  InvalidChainId = 'INVALID_CHAIN_ID',
  AddressAlreadyExists = 'ADDRESS_ALREADY_EXISTS',
  AddressNotFound = 'ADDRESS_NOT_FOUND',
}

export const buildInvalidChainId = (
  network: string | null,
  chainId: string | null,
): ApolloError => new ApolloError(
  `Chain id ${chainId} is not supported for network ${network}`,
  HTTP.BadRequest,
  { errorKey: ErrorType.InvalidChainId },
)

export const buildInvalidNetwork = (network: string | null): ApolloError =>
  new ApolloError(
    `Network ${network} is not supported`,
    HTTP.BadRequest,
    { errorKey: ErrorType.InvalidNetwork },
  )

export const buildAddressExistsMsg = (
  network: string,
  chain: Chain,
  address: string,
): string =>
  `Address ${address} already exists for chain ${network}:${chain.id}:${chain.name}`

export const buildAddressNotFoundMsg = (): string =>
  'Please signup or add this address before using'
