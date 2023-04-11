import 'dotenv/config'

import { isString } from 'lodash'
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions'

import { _logger, defs, helper } from '@nftcom/shared'
import * as Sentry from '@sentry/node'

const logger = _logger.Factory(_logger.Context.General, _logger.Context.Misc)

export const verifyConfiguration = (): void => {
  logger.debug('Loading configurations...')
}

const lookupEnvKeyOrThrow = (key: string): string => {
  const value = process.env[key]
  if (isString(value)) {
    return value
  }
  throw new Error(`Environment variable ${key} is required`)
}

export const serverPort = parseInt(process.env.PORT) || 8080
export const nodeEnv = process.env.NODE_ENV
export const authMessage = lookupEnvKeyOrThrow('AUTH_MESSAGE')
export const sgAPIKey = lookupEnvKeyOrThrow('SG_API_KEY')
export const confirmEmailUrl = lookupEnvKeyOrThrow('CONFIRM_EMAIL_URL')
export const teamPassword = lookupEnvKeyOrThrow('TEAM_AUTH_TOKEN')
export const authExpireDuration = parseInt(process.env.AUTH_EXPIRE_BY_DAYS) || 7

export const serverConfigVar = (): any => {
  const defaultConfig = {
    activeGKPreferencePhase: 1,
  }
  try {
    return JSON.parse(process.env.SERVER_CONFIG) ?? defaultConfig
  } catch (e) {
    Sentry.captureException(e)
    Sentry.captureMessage(`Error in serverConfigVar: ${e}`)
    return defaultConfig
  }
}

export const isProduction = (): boolean => {
  return process.env.NODE_ENV === 'production'
}

export const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: 5432,
  username: process.env.DB_USERNAME || 'app',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_DATABASE || 'app',
  logging: helper.parseBoolean(process.env.DB_LOGGING) || false,
}

export const testDBConfig: Partial<PostgresConnectionOptions> = {
  type: 'postgres',
  host: process.env.TEST_DB_HOST,
  port: parseInt(process.env.TEST_DB_PORT),
  username: process.env.TEST_DB_USERNAME,
  password: process.env.TEST_DB_PASSWORD,
  database: process.env.TEST_DB_DATABASE,
  logging: false,
  dropSchema: true,
  synchronize: false,
}

const toNetwork = (str: string): defs.Network => {
  const list = str.split('|')
  return list.reduce((agg: defs.Network, val: string) => {
    const kvs = val.split(':')
    const network = kvs[0]
    agg[network] = agg[network] || []
    agg[network].push({
      id: kvs[1],
      name: kvs[2],
    })
    return agg
  }, {})
}

export const supportedNetworks = toNetwork(lookupEnvKeyOrThrow('SUPPORTED_NETWORKS'))

export const blockchainConfig = {
  networksURI: new Map<string, string>(),
  contractIds: new Map<string, string>(),
  contractAccountPK: '',
}

export const isNetworkSupported = (network: string): boolean => helper.isNotEmpty(supportedNetworks[network])

export const getChain = (network: string, chainId: string): defs.Chain =>
  supportedNetworks[network].find((chain: defs.Chain) => chain.id === chainId)

export const assetBucket = {
  name: lookupEnvKeyOrThrow('ASSET_BUCKET'),
  role: lookupEnvKeyOrThrow('ASSET_BUCKET_ROLE'),
}
