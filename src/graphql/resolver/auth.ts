import { skip } from 'graphql-resolvers'
import { isEmpty } from 'lodash'

import { getChain, isNetworkSupported } from '@src/config'
import { Context } from '@src/db'
import { misc } from '@src/defs'
import { appError, userError, walletError } from '@src/graphql/error'

export const isAuthenticated = (_: any, args: any, ctx: Context): any => {
  const { wallet, user } = ctx
  if (isEmpty(wallet)) {
    return appError.buildNotFound(
      walletError.buildAddressNotFoundMsg(),
      walletError.ErrorType.AddressNotFound,
    )
  }
  if (isEmpty(user)) {
    return userError.buildAuth()
  }
  return skip
}

export const verifyAndGetNetworkChain = (network: string, chainId: string): misc.Chain => {
  if (!isNetworkSupported(network)) {
    throw walletError.buildInvalidNetwork(network)
  }
  const chain = getChain(network, chainId)
  if (isEmpty(chain)) {
    throw walletError.buildInvalidChainId(network, chainId)
  }
  return chain
}
