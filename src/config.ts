/* eslint-disable @typescript-eslint/no-var-requires */
require('dotenv').config()

import { parseBoolean } from '@src/helper/misc'

export const verifyConfiguration = (): void => {
  console.log('Loading configurations...')
}

export const serverPort = parseInt(process.env.PORT) || 8080

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
  logging: parseBoolean(process.env.DB_LOGGING) || false,
  migrationDirectory: process.env.DB_MIGRATION_DIR || 'dist/db/migration',
}

export const blockchainConfig = {
  networksURI: new Map<string, string>(),
  contractIds: new Map<string, string>(),
  contractAccountPK: '',
}
