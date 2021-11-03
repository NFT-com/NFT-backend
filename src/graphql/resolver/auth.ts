import { skip } from 'graphql-resolvers'
import { isEmpty } from 'lodash'

import { getChain, isNetworkSupported } from '@src/config'
import { Context } from '@src/db'
import { Chain } from '@src/defs'
import { userError, walletError } from '@src/graphql/error'

export const isAuthenticated = (_: any, args: any, ctx: Context): any => {
  const { wallet, user } = ctx
  if (isEmpty(wallet)) {
    return walletError.buildAddressNotFound()
  }
  if (isEmpty(user)) {
    return userError.buildAuthError()
  }
  return skip
}

export const verifyAndGetNetworkChain = (network: string, chainId: string): Chain => {
  if (!isNetworkSupported(network)) {
    throw walletError.buildInvalidNetworkError(network)
  }
  const chain = getChain(network, chainId)
  if (isEmpty(chain)) {
    throw walletError.buildInvalidChainIdError(network, chainId)
  }
  return chain
}
