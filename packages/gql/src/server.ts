import { ApolloServer } from 'apollo-server'
import {
  ApolloServerPluginLandingPageGraphQLPlayground,
  ApolloServerPluginLandingPageProductionDefault,
} from 'apollo-server-core'
import { utils } from 'ethers'
import { GraphQLError } from 'graphql'

import { authMessage, isProduction, serverPort } from '@nftcom/gql/config'
import { Context } from '@nftcom/gql/defs'
import { auth } from '@nftcom/gql/helper'
import { resolvers } from '@nftcom/gql/resolver'
import { typeDefs } from '@nftcom/gql/schema'
import { _logger, db, defs, entity, helper } from '@nftcom/shared'

const logger = _logger.Factory(_logger.Context.General, _logger.Context.GraphQL)
const networkHeader = 'network'
const chainIdHeader = 'chain-id'
const authHeader = 'authorization'

type GQLError = {
  statusCode: string
  errorKey?: string
  message: string
  path: Array<string | number>
}

const getAddressFromSignature = (signature: string): string =>
  utils.verifyMessage(authMessage, signature)

const createContext = async (ctx): Promise<Context> => {
  const { req, connection } = ctx
  // * For subscription and query-mutation, gql handles headers differently 😪
  const headers = connection && connection.context ? connection.context : req.headers

  const network = headers[networkHeader] || null
  const chainId = headers[chainIdHeader] || null
  const authSignature = headers[authHeader] || null
  let chain: defs.Chain = null
  let wallet: entity.Wallet = null
  let user: entity.User = null
  const repositories = db.newRepositories()
  if (helper.isNotEmpty(authSignature)) {
    chain = auth.verifyAndGetNetworkChain(network, chainId)
    const address = getAddressFromSignature(authSignature)
    // TODO fetch from cache
    wallet = await repositories.wallet.findByNetworkChainAddress(network, chainId, address)
    user = await repositories.user.findById(wallet?.userId)
  }

  return {
    network,
    chain,
    wallet,
    user,
    repositories,
  }
}

const formatError = (error: GraphQLError): GQLError => {
  const { message, path, extensions } = error
  const errorKey = extensions?.['errorKey'] || 'UNKNOWN'
  const statusCode = extensions?.['code'] || ''
  logger.error('formatError', {
    message,
    statusCode,
    errorKey,
    stacktrace: extensions?.['exception']?.['stacktrace'],
    path,
  })
  return <GQLError>{
    statusCode,
    errorKey,
    message,
    path,
  }
}

let server: ApolloServer
export const start = async (): Promise<void> => {
  if (server) {
    return
  }

  const playground = isProduction()
    ? ApolloServerPluginLandingPageProductionDefault()
    : ApolloServerPluginLandingPageGraphQLPlayground()
  server = new ApolloServer({
    cors: true,
    resolvers: resolvers,
    typeDefs: typeDefs(),
    context: createContext,
    formatError,
    plugins: [
      playground,
    ],
  })
  const { url } = await server.listen(serverPort)
  console.log(`🚀  Server ready at ${url}`)
}

export const stop = (): Promise<void> => {
  if (!server) {
    return
  }
  return server.stop()
}
