import { ApolloServerPluginDrainHttpServer, ApolloServerPluginLandingPageDisabled } from 'apollo-server-core'
import { ApolloServer } from 'apollo-server-express'
import cors from 'cors'
import cryptoRandomString from 'crypto-random-string'
import { addDays, differenceInCalendarDays } from 'date-fns'
import { utils } from 'ethers'
import express from 'express'
import rateLimiter from 'express-rate-limit'
import { GraphQLError } from 'graphql'
import graphqlUploadExpress from 'graphql-upload/graphqlUploadExpress.js'
import http from 'http'
import Keyv from 'keyv'
import { pinoHttp } from 'pino-http'

import { KeyvAdapter } from '@apollo/utils.keyvadapter'
import KeyvRedis from '@keyv/redis'
import { cache } from '@nftcom/cache'
import { appError, profileError, userError } from '@nftcom/error-types'
import { sendgrid } from '@nftcom/gql/service'
import { checkAddressIsSanctioned } from '@nftcom/gql/service/core.service'
import { _logger, db, defs, entity, helper } from '@nftcom/shared'
import * as Sentry from '@sentry/node'
import * as Tracing from '@sentry/tracing'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { authExpireDuration, authMessage, serverPort } from './config'
import {
  listingsByNFT,
  listingsByNFTCancelled,
  listingsByNFTExecuted,
  listingsByNFTExpired,
  listingsByNFTExpiredAndCancelled,
  listingsByNFTExpiredAndExecuted,
  nft,
  nftsByWalletId,
  wallet as walletLoader,
} from './dataloader'
import { Context } from './defs'
import { auth, validate } from './helper'
import { rateLimitedSchema } from './schema'

const logger = _logger.Factory(_logger.Context.General, _logger.Context.GraphQL)
const networkHeader = 'network'
const chainIdHeader = 'chain-id'
const authHeader = 'authorization'
const timestampHeader = 'timestamp'

const repositories = db.newRepositories()

type GQLError = {
  statusCode: string
  errorKey?: string
  message: string
  path: Array<string | number>
}

const getAddressFromSignature = (authMsg, signature: string): string =>
  utils.verifyMessage(authMsg, signature)

export const createLoaders = (): any => {
  return {
    listingsByNFT,
    listingsByNFTExecuted,
    listingsByNFTCancelled,
    listingsByNFTExpired,
    listingsByNFTExpiredAndCancelled,
    listingsByNFTExpiredAndExecuted,
    nft,
    nftsByWalletId,
    wallet: walletLoader,
  }
}

export const createContext = async (ctx): Promise<Context> => {
  const { req, connection } = ctx
  // * For subscription and query-mutation, gql handles headers differently 😪
  const headers = connection && connection.context ? connection.context : req?.headers

  const network = headers[networkHeader] || null
  const chainId = headers[chainIdHeader] || null
  const authSignature = headers[authHeader] || null
  const xMintSignature = headers['x-mint-signature'] || null
  const timestamp = headers[timestampHeader] || null
  let chain: defs.Chain = null
  let wallet: entity.Wallet = null
  let user: entity.User = null
  const teamKey: string = headers['teamkey']
  const hasAuthSignature = helper.isNotEmpty(authSignature)

  if (hasAuthSignature && timestamp) {
    // Attempting auth with signature and timestamp
    const nowDate = helper.toUTCDate()
    const expireDate = new Date(Number(timestamp) * 1000)

    // If expire duration is out of our expiry limit (AUTH_EXPIRE_BY_DAYS), this request should be rejected
    const difference = differenceInCalendarDays(nowDate, expireDate)
    if (Number(expireDate) - Number(nowDate) < 0 || difference > authExpireDuration) {
      logger.error({ req, connection }, 'Auth failed for request')
      return Promise.reject(userError.buildAuthOutOfExpireDuration(nowDate, expireDate, authExpireDuration, difference))
    }
    // If auth header is out of expire duration, this request should be rejected
    const now = nowDate.getTime() / 1000
    if (Number(timestamp) < now) {
      logger.error({ req, connection }, 'Expired auth for request')
      return Promise.reject(userError.buildAuthExpired())
    }
    chain = auth.verifyAndGetNetworkChain(network, chainId)
    // we check signature and nonce to get wallet address
    const msg = `${authMessage} ${timestamp}`
    const address = getAddressFromSignature(msg, authSignature)
    // check if address is in OFAC list
    const isSanctioned = await checkAddressIsSanctioned(address)
    if (isSanctioned) {
      return Promise.reject(userError.buildAddressSanctioned())
    }
    // TODO fetch from cache
    wallet = await repositories.wallet.findByNetworkChainAddress(network, chainId, address)
    if (wallet && wallet.id) {
      walletLoader.clear(wallet.id).prime(wallet.id, wallet)
      user = await repositories.user.findById(wallet?.userId)
    } else {
      logger.warn({ address, chainId, network, wallet },
        'User attempting to authenticate, but wallet missing from the database.')
    }
  } else if (hasAuthSignature) {
    // Auth signature, but no timestamp is forbidden
    return Promise.reject(userError.buildAuthInvalid())
  } // Else, create context for unauthenticated requests

  return {
    network,
    chain,
    wallet,
    user,
    repositories,
    teamKey,
    xMintSignature,
    loaders: createLoaders(),
  }
}

export const formatError = (error: GraphQLError): GQLError => {
  const { message, path, extensions } = error
  const errorKey = extensions?.['errorKey'] || 'UNKNOWN'
  const statusCode = extensions?.['code'] || ''
  logger.error({
    message,
    statusCode,
    errorKey,
    stacktrace: extensions?.['exception']?.['stacktrace'].join('\n'),
    path,
  })
  return <GQLError>{
    statusCode,
    errorKey,
    message,
    path,
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const errorHandler = (err: Error, req, res, _next): void => {
  const path = req.path || req.originalUrl
  const responseData = { path, statusCode: '500', message: 'An error has occured' }
  logger.error({ ...responseData, message: undefined, err })
  res.status(500).send(responseData)
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

  app.use(pinoHttp({
    logger: _logger.parent,
    autoLogging: {
      ignore: (req) => {
        return (
          ['/.well-known/apollo/server-health', '/favicon.ico', '/'].includes(req.url)
          || req.method === 'OPTIONS'
        )
      },
    },
    customLogLevel: function (_req, res, err) {
      if (res.statusCode >= 400 && res.statusCode < 500) {
        return 'warn'
      } else if (res.statusCode >= 500 || err) {
        return 'error'
      }
      return 'silent'
    },
  }))

  app.use(Sentry.Handlers.requestHandler())
  app.use(cors())

  // IP specific (10 req / minute)
  const subscribeLimiter = rateLimiter({
    max: 10,
    message: { message: 'Too many requests. Try again later.' },
  })

  // subscribe new email
  app.post('/subscribe/:email', subscribeLimiter, validate.validate(validate.emailSchema), async function (req, res) {
    const { email } = req.params

    const foundUser = await repositories.user.findOne({
      where: {
        email: email?.toLowerCase(),
        username: `marketing-${email?.toLowerCase()}`,
      },
    })

    if (foundUser?.isEmailConfirmed) {
      return res.status(400).json({ message: 'User already exists' })
    } else if (new Date(foundUser?.confirmEmailTokenExpiresAt) > new Date()) {
      return res.status(400).json({ message: 'Email already sent' })
    } else {
      return repositories.user.save({
        ...foundUser,
        email: email?.toLowerCase(),
        username: `marketing-${email?.toLowerCase()}`,
        referredBy: null,
        avatarURL: null,
        confirmEmailToken: cryptoRandomString({ length: 36, type: 'url-safe' }),
        confirmEmailTokenExpiresAt: addDays(helper.toUTCDate(), 1),
        referralId: cryptoRandomString({ length: 10, type: 'url-safe' }),
      })
        .then(user => sendgrid.sendConfirmEmail(user))
        .then(() => res.status(200).json({ message: 'success' }))
    }
  })

  // verify new email and add to homepage v2 sendgrid marketing list
  app.get('/verify/:email/:token', validate.validate(validate.verifySchema), async function (req, res) {
    const { email, token } = req.params

    return repositories.user.findOne({ where:
      {
        email: email?.toLowerCase(),
        confirmEmailToken: token,
      },
    }).then(user => {
      if (!user) {
        return res.status(400).json({
          message: 'Invalid email token pair',
        })
      } else {
        if (user?.isEmailConfirmed) {
          return res.status(400).json({
            message: 'User already verified',
          })
        }
        return repositories.user.save({
          ...user,
          isEmailConfirmed: true,
        })
          .then(() => sendgrid.addEmailToList(email?.toLowerCase()))
          .then(() => sendgrid.sendSuccessSubscribeEmail(email?.toLowerCase()))
          .then(() => res.status(200).json({
            message: 'successfully verified!',
          }))
      }
    })
  })

  app.get('/uri/:username', async function (req, res) {
    const { username } = req.params
    const chainId = process.env.CHAIN_ID

    const key = `${username}_${chainId}`
    const cachedData = await cache.get(key)

    if (cachedData) {
      return res.send(JSON.parse(cachedData as string))
    } else {
      return repositories.profile.findByURL(username.toLowerCase(), chainId)
        .then(async (profile: entity.Profile) => {
          if (!profile) {
            return res.send({
              name: username.toLowerCase(),
              image: 'https://cdn.nft.com/nullPhoto.png',
              header: 'https://cdn.nft.com/profile-banner-default-logo-key.png',
              description: `NFT.com profile for ${username.toLowerCase()}`,
              attributes: [
                {
                  trait_type: 'name',
                  value: username.toLowerCase(),
                },
              ],
            })
          } else {
            const data = {
              name: username?.toLowerCase(),
              image: profile.photoURL ?? 'https://cdn.nft.com/nullPhoto.png',
              header: profile.bannerURL ?? 'https://cdn.nft.com/profile-banner-default-logo-key.png',
              description: profile.description ?? `NFT.com profile for ${username.toLowerCase()}`,
              attributes: [
                {
                  trait_type: 'name',
                  value: username.toLowerCase(),
                },
              ],
            }
            await cache.set(key, JSON.stringify(data), 'EX', 60 * 10)
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
    cache: new KeyvAdapter(new Keyv({ store: new KeyvRedis(cache) }), {
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
  app.disable('x-powered-by')

  await server.start()
  server.applyMiddleware({ app })
  await new Promise<void>(resolve => httpServer.listen({ port: serverPort }, resolve))
  logger.info(`🚀 Server ready at http://localhost:${serverPort}${server.graphqlPath}`)
}

export const stop = (): Promise<void> => {
  if (!server) {
    return
  }
  return server.stop()
}
