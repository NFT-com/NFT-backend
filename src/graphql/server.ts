import { ApolloServer } from 'apollo-server'
import {
  ApolloServerPluginLandingPageGraphQLPlayground,
  ApolloServerPluginLandingPageProductionDefault,
} from 'apollo-server-core'
import { GraphQLError } from 'graphql'

import { blockchain } from '@src/blockchain'
import { isProduction, serverPort } from '@src/config'
import { Context, entity, newRepositories } from '@src/db'
import { Chain } from '@src/defs'
import { resolvers } from '@src/graphql/resolver'
import { verifyAndGetNetworkChain } from '@src/graphql/resolver/auth'
import { typeDefs } from '@src/graphql/schema'
import { helper } from '@src/helper'
import { LoggerContext,LoggerFactory } from '@src/helper/logger'

const logger = LoggerFactory(LoggerContext.General, LoggerContext.GraphQL)
const networkHeader = 'network'
const chainIdHeader = 'chain-id'
const authHeader = 'authorization'

type GQLError = {
  statusCode: string
  errorKey?: string
  message: string
  path: Array<string | number>
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

const createContext = async (ctx): Promise<Context> => {
  const { req, connection } = ctx
  // * For subscription and query-mutation, gql handles headers differently 😪
  const headers = connection && connection.context ? connection.context : req.headers

  const network = headers[networkHeader] || null
  const chainId = headers[chainIdHeader] || null
  const authSignature = headers[authHeader] || null
  let chain: Chain = null
  let wallet: entity.Wallet = null
  let user: entity.User = null
  const repositories = newRepositories()
  if (helper.isNotEmpty(authSignature)) {
    chain = verifyAndGetNetworkChain(network, chainId)
    const address = blockchain.getAddressFromSignature(authSignature)
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
