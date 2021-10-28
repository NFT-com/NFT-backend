import { ApolloServer } from 'apollo-server'
import { GraphQLError } from 'graphql'

import { typeDefs } from '@src/graphql/schema'
import { resolvers } from '@src/graphql/resolver'
import { Context, repository } from '@src/db'
import { blockchain } from '@src/blockchain'
import { LoggerFactory } from '@src/helper/logger'

const logger = LoggerFactory('Apollo Server', 'GraphQL')
const chainIdHeader = 'chain-id'
const authHeader = 'authorization'

const formatError = (error: GraphQLError): GraphQLError => {
  logger.error('ERROR: formatError', {
    code: error.extensions['code'],
    exception: error.extensions['code.exception'],
    error,
  })
  return error
}

const createContext = (ctx): Context => {
  const { req, connection } = ctx
  // * For subscription and query-mutation, gql handles headers differently 😪
  const headers = connection && connection.context ? connection.context : req.headers

  const chainId = headers[chainIdHeader] || null
  const authSignature = headers[authHeader] || null
  let address: string = null
  if (authSignature !== null) {
    // TODO get logged in user
    address = blockchain.getAddressFromSignature(authSignature)
  }

  return {
    address,
    chainId,
    repository,
  }
}

let server: ApolloServer
export const start = async (port: number): Promise<void> => {
  if (server) {
    return
  }

  server = new ApolloServer({
    cors: true,
    resolvers: resolvers,
    typeDefs: typeDefs(),
    context: createContext,
    formatError,
  })
  const { url } = await server.listen(port)
  console.log(`🚀  Server ready at ${url}`)
}

export const stop = (): Promise<void> => {
  if (!server) {
    return
  }
  return server.stop()
}
