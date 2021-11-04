/* eslint-disable @typescript-eslint/no-var-requires */
require('dotenv').config()
import { isString } from 'lodash'

import { misc } from '@src/defs'
import { helper } from '@src/helper'

export const verifyConfiguration = (): void => {
  console.log('Loading configurations...')
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

export const isProduction = (): boolean => {
  return process.env.NODE_ENV === 'production'
}

export const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
}

export const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  user: process.env.DB_USERNAME || 'app',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_DATABASE || 'app',
  logging: helper.parseBoolean(process.env.DB_LOGGING) || false,
  migrationDirectory: process.env.DB_MIGRATION_DIR || 'dist/db/migration',
}

const toNetwork = (str: string): misc.Network => {
  const list = str.split('|')
  return list.reduce((agg: misc.Network, val: string) => {
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

const supportedNetworks = toNetwork(lookupEnvKeyOrThrow('SUPPORTED_NETWORKS'))

export const blockchainConfig = {
  networksURI: new Map<string, string>(),
  contractIds: new Map<string, string>(),
  contractAccountPK: '',
}

export const isNetworkSupported = (network: string): boolean =>
  helper.isNotEmpty(supportedNetworks[network])

export const getChain = (network: string, chainId: string): misc.Chain =>
  supportedNetworks[network].find((chain: misc.Chain) => chain.id === chainId)
