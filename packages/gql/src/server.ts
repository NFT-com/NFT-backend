import { ApolloServerPluginDrainHttpServer } from 'apollo-server-core'
import { ApolloServer } from 'apollo-server-express'
import { utils } from 'ethers'
import express from 'express'
import { GraphQLError } from 'graphql'
import http from 'http'

import { appError, profileError } from '@nftcom/gql/error'
import { _logger, db, defs, entity, helper } from '@nftcom/shared'
import * as Sentry from '@sentry/node'
import * as Tracing from '@sentry/tracing'

import { authMessage, isProduction, serverPort } from './config'
import { Context } from './defs'
import { auth } from './helper'
import { resolvers } from './resolver'
import { typeDefs } from './schema'

const logger = _logger.Factory(_logger.Context.General, _logger.Context.GraphQL)
const networkHeader = 'network'
const chainIdHeader = 'chain-id'
const authHeader = 'authorization'

const repositories = db.newRepositories()

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
  const teamKey: string = headers['teamkey']
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
    teamKey,
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

  const app = express()

  Sentry.init({
    dsn: 'https://c85a378b6d144868956d80b10c460b5b@o1088732.ingest.sentry.io/6198744',
    integrations: [
      // enable HTTP calls tracing
      new Sentry.Integrations.Http({ tracing: true }),
      // enable Express.js middleware tracing
      new Tracing.Integrations.Express({
        app,
      }),
    ],
    // Set tracesSampleRate to 1.0 to capture 100%
    // of transactions for performance monitoring.
    // We recommend adjusting this value in production
    tracesSampleRate: 1.0,
  })

  const httpServer = http.createServer(app)

  app.use(Sentry.Handlers.requestHandler())

  // TODO: user CDN urls later for default image and header
  app.get('/uri/:username', function (req, res) {
    const { username } = req.params

    return repositories.profile.findByURL(username.toLowerCase())
      .then((profile: entity.Profile) => {
        if (!profile) {
          return Promise.reject(appError.buildExists(
            profileError.buildProfileNotFoundMsg(username),
            profileError.ErrorType.ProfileNotFound,
          ))
        } else {
          return res.send({
            name: req.params.username,
            image: profile.photoURL ?? 'https://nft-com.s3.us-east-2.amazonaws.com/nullPhoto.svg',
            header: profile.bannerURL ?? 'https://nft-com.s3.us-east-2.amazonaws.com/nullBanner.svg',
            description: profile.description ?? `NFT.com profile for ${username.toLowerCase()}`,
          })
        }
      })
  })

  server = new ApolloServer({
    introspection: helper.isFalse(isProduction()),
    resolvers: resolvers,
    typeDefs: typeDefs(),
    context: createContext,
    formatError,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
  })

  app.use(Sentry.Handlers.errorHandler())

  await server.start()
  server.applyMiddleware({ app, cors: true })
  await new Promise<void>(resolve => httpServer.listen({ port: serverPort }, resolve))
  console.log(`🚀 Server ready at http://localhost:${serverPort}${server.graphqlPath}`)
}

export const stop = (): Promise<void> => {
  if (!server) {
    return
  }
  return server.stop()
}
