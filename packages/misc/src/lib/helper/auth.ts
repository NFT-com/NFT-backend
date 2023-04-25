import { skip } from 'graphql-resolvers'

import { appError, userError, walletError } from '@nftcom/error-types'
import { defs, helper } from '@nftcom/shared'

import { getChain, isNetworkSupported, teamPassword } from '../config'
import { Context } from '../defs'

/**
 * A function that checks if the user is authenticated.
 * @param {any} _ - The GraphQL context.
 * @param {any} args - The GraphQL arguments.
 * @param {Context} ctx - The GraphQL context.
 * @returns {any} - The result of the function.
 */
export const isAuthenticated = (_: any, args: any, ctx: Context): any => {
  const { wallet, user } = ctx

  if (helper.isEmpty(wallet)) {
    return appError.buildNotFound(walletError.buildAddressNotFoundMsg(), walletError.ErrorType.AddressNotFound)
  }
  if (helper.isEmpty(user)) {
    return userError.buildAuth()
  }
  return skip
}

/**
 * TODO: Look into replacing functionality w/ [GraphQL Shield](https://github.com/dimatill/graphql-shield)
 */
/**
 * Internal auth util that verifies if user has an authorized team key and wallet.
 * @param {any} _ - The GraphQL context.
 * @param {any} args - The GraphQL arguments.
 * @param {Context} ctx - The GraphQL context.
 * @returns None
 */
export const isTeamAuthenticated = (_: any, args: any, ctx: Context): any => {
  const { wallet, teamKey } = ctx
  if (helper.isEmpty(wallet)) {
    return appError.buildNotFound(walletError.buildAddressNotFoundMsg(), walletError.ErrorType.AddressNotFound)
  }

  // TODO (eddie): add wallet allowlist too for extra security
  if (teamKey !== teamPassword) {
    return appError.buildForbidden(userError.buildForbiddenActionMsg(), userError.ErrorType.ForbiddenAction)
  }
}

/**
 * Internal auth utility that checks if teamKey provided is valid.
 * (Verifies that valid team )
 * @param {any} _ - The GraphQL context.
 * @param {any} args - The GraphQL arguments.
 * @param {Context} ctx - The GraphQL context.
 * @returns {any} The result of the function.
 */
export const isTeamKeyAuthenticated = (_: any, args: any, ctx: Context): any => {
  if (ctx?.teamKey !== teamPassword) {
    return appError.buildForbidden(userError.buildForbiddenActionMsg(), userError.ErrorType.ForbiddenAction)
  }
}

/**
 * Verifies that the given network and chain are supported.
 * @param {string} network - the network to check
 * @param {string} chainId - the chain to check
 * @returns {defs.Chain} the chain object
 */
export const verifyAndGetNetworkChain = (network: string, chainId: string): defs.Chain => {
  if (!isNetworkSupported(network)) {
    throw walletError.buildInvalidNetwork(network)
  }
  const chain = getChain(network, chainId)
  if (helper.isEmpty(chain)) {
    throw walletError.buildInvalidChainId(network, chainId)
  }
  return chain
}
