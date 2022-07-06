import { ApolloServerPluginDrainHttpServer, ApolloServerPluginLandingPageDisabled } from 'apollo-server-core'
import { ApolloServer } from 'apollo-server-express'
import { exec } from 'child_process'
import cors from 'cors'
import { utils } from 'ethers'
import express from 'express'
import { GraphQLError } from 'graphql'
import { graphqlUploadExpress } from 'graphql-upload'
import http from 'http'
import Redis from 'ioredis'
import Keyv from 'keyv'
import * as util from 'util'

import { KeyvAdapter } from '@apollo/utils.keyvadapter'
import KeyvRedis from '@keyv/redis'
import { redisConfig } from '@nftcom/gql/config'
import { appError, profileError } from '@nftcom/gql/error'
import { _logger, db, defs, entity, helper } from '@nftcom/shared'
import * as Sentry from '@sentry/node'
import * as Tracing from '@sentry/tracing'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { authMessage, serverPort } from './config'
import { Context } from './defs'
import { auth } from './helper'
import { rateLimitedSchema } from './schema'

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

const redis = new Redis({
  host: redisConfig.host,
  port: redisConfig.port,
})

const getAddressFromSignature = (signature: string): string =>
  utils.verifyMessage(authMessage, signature)

export const createContext = async (ctx): Promise<Context> => {
  const { req, connection } = ctx
  // * For subscription and query-mutation, gql handles headers differently 😪
  const headers = connection && connection.context ? connection.context : req?.headers

  const network = headers[networkHeader] || null
  const chainId = headers[chainIdHeader] || null
  const authSignature = headers[authHeader] || null
  const xMintSignature = headers['x-mint-signature'] || null
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
    xMintSignature,
  }
}

export const formatError = (error: GraphQLError): GQLError => {
  const { message, path, extensions } = error
  const errorKey = extensions?.['errorKey'] || 'UNKNOWN'
  const statusCode = extensions?.['code'] || ''
  logger.error('formatError', JSON.stringify({
    message,
    statusCode,
    errorKey,
    stacktrace: extensions?.['exception']?.['stacktrace'].join('\n'),
    path,
  }))
  return <GQLError>{
    statusCode,
    errorKey,
    message,
    path,
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const errorHandler = (err: Error, req, res, next): void => {
  const { stack, message } = err
  const path = req.path || req.originalUrl
  const responseData = { path, statusCode: '500', message: 'An error has occured' }
  logger.error(JSON.stringify({ ...responseData, message, stacktrace: stack }))
  res.status(500).send(responseData)
}

const execShellCommand = (
  command: string,
  swallowError = false,
  description: string,
): Promise<void> => {
  const promisifiedExec = util.promisify(exec)
  return promisifiedExec(command)
    .then(({ stdout, stderr }) => {
      const err = stderr.replace('\n', '').trim()
      if (helper.isNotEmpty(err) && helper.isFalse(swallowError)) {
        return Promise.reject(new Error(`Something went wrong with command ${command}. Error: ${err}`))
      }
      if (helper.isNotEmpty(err) && swallowError) {
        logger.error('SWALLOWING ERROR', err)
        return Promise.resolve()
      }
      logger.info(description, stdout.replace('\n', '').trim())
      return Promise.resolve()
    })
}

let server: ApolloServer
export const start = async (): Promise<void> => {
  if (server) {
    return
  }

  const app = express()

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
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
  app.use(cors())

  app.get('/uri/:username', async function (req, res) {
    const { username } = req.params

    const cachedData = await redis.get(username)

    if (cachedData) {
      return res.send(JSON.parse(cachedData))
    } else {
      return repositories.profile.findByURL(username.toLowerCase())
        .then(async (profile: entity.Profile) => {
          if (!profile) {
            return res.send({
              name: username.toLowerCase(),
              image: 'https://cdn.nft.com/nullPhoto.png',
              header: 'https://cdn.nft.com/profile-banner-default-logo-key.png',
              description: `NFT.com profile for ${username.toLowerCase()}`,
            })
          } else {
            const data = {
              name: username?.toLowerCase(),
              image: profile.photoURL ?? 'https://cdn.nft.com/nullPhoto.png',
              header: profile.bannerURL ?? 'https://cdn.nft.com/profile-banner-default-logo-key.png',
              description: profile.description ?? `NFT.com profile for ${username.toLowerCase()}`,
            }
            await redis.set(username, JSON.stringify(data), 'EX', 60)
            return res.send(data)
          }
        })
    }
  })

  app.get('/gk/:key', function (req, res) {
    const { key } = req.params

    if (!isNaN(Number(key)) && Number(key) >= 1 && Number(key) <= 10000) {
      const url = 'https://nft-llc.mypinata.cloud/ipfs/Qmf4gLHJkjEmfzQyhxDpeQZeeEZdfAdh8FAEtdcLxAu3bi'
      return res.send(
        `<!DOCTYPE html>
        <html lang="en">
          <head>
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:site" content="@nftcomofficial" />
                <meta name="twitter:creator" content="nft.com" />
                <meta name="twitter:title" content="Check out my Genesis Key!" />
                <meta
                  name="twitter:description"
                  content="Genesis Keys are very very important." />
                <meta
                  name="twitter:image"
                  content="${url}" />
          </head>
          <body>
            <img alt="genesis key" src="${url}" />
          </body>
        </html>`,
      )
    } else {
      return Promise.reject(appError.buildExists(
        profileError.buildKeyNotValid(key),
        profileError.ErrorType.KeyInvalid,
      ))
    }
  })

  const schema = rateLimitedSchema()

  server = new ApolloServer({
    //gql schema only visibly locally
    schema,
    cache: new KeyvAdapter(new Keyv({ store: new KeyvRedis(redis) }), {
      disableBatchReads: true,
    }),
    introspection: process.env.NODE_ENV === 'local',
    context: createContext,
    formatError,
    // disable landingPage for prod
    plugins: [
      process.env.NODE_ENV === 'production'
        ? ApolloServerPluginLandingPageDisabled()
        : ApolloServerPluginDrainHttpServer({ httpServer }),
    ],
  })

  app.use(Sentry.Handlers.errorHandler())
  app.use(graphqlUploadExpress({ maxFileSize: 1000000 * 10, maxFiles: 2 })) // maxFileSize: 10 mb
  app.use(cors())
  app.use(errorHandler)

  await server.start()
  server.applyMiddleware({ app })
  await new Promise<void>(resolve => httpServer.listen({ port: serverPort }, resolve))
  if (process.env.NODE_ENV === 'local') {
    await execShellCommand('npm run gqldoc', true, '📚 GQL Documentation:')
  }
  logger.info(`🚀 Server ready at http://localhost:${serverPort}${server.graphqlPath}`)
}

export const stop = (): Promise<void> => {
  if (!server) {
    return
  }
  return server.stop()
}
