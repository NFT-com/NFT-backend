import { skip } from 'graphql-resolvers'

import { getChain, isNetworkSupported, teamPassword } from '@nftcom/gql/config'
import { Context } from '@nftcom/gql/defs'
import { appError, userError, walletError } from '@nftcom/gql/error'
import { defs, helper } from '@nftcom/shared'

export const isAuthenticated = (_: any, args: any, ctx: Context): any => {
  const { wallet, user } = ctx

  if (helper.isEmpty(wallet)) {
    return appError.buildNotFound(
      walletError.buildAddressNotFoundMsg(),
      walletError.ErrorType.AddressNotFound,
    )
  }
  if (helper.isEmpty(user)) {
    return userError.buildAuth()
  }
  return skip
}

export const isTeamAuthenticated = (_: any, args: any, ctx: Context): any => {
  const { wallet, teamKey } = ctx
  if (helper.isEmpty(wallet)) {
    return appError.buildNotFound(
      walletError.buildAddressNotFoundMsg(),
      walletError.ErrorType.AddressNotFound,
    )
  }

  // TODO (eddie): add wallet allowlist too for extra security
  if (teamKey !== teamPassword) {
    return appError.buildForbidden(
      userError.buildForbiddenActionMsg(),
      userError.ErrorType.ForbiddenAction,
    )
  }
}

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
