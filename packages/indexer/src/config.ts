import 'dotenv/config'

import { helper } from '@nftcom/shared'

export const verifyConfiguration = (): void => {
  console.log('Loading configurations...')
}

export const serverPort = parseInt(process.env.PORT) || 8080
export const nodeEnv = process.env.NODE_ENV

export const isProduction = (): boolean => {
  return process.env.NODE_ENV === 'production'
}

export const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
}

export const provider = (): string => {
  const etherscanArray = process.env.ETHERSCAN_APIS.split(',')

  const maxIndex = etherscanArray.length - 1
  const minIndex = 0

  const randomIndex = (Math.random() * (maxIndex - minIndex + 1)) << 0
  return etherscanArray[randomIndex]
}

export const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  user: process.env.DB_USERNAME || 'app',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_DATABASE || 'app',
  logging: helper.parseBoolean(process.env.DB_LOGGING) || false,
  migrationDirectory: process.env.DB_MIGRATION_DIR || 'dist/db/migration',
  useSSL: helper.parseBoolean(process.env.DB_USE_SSL),
}
