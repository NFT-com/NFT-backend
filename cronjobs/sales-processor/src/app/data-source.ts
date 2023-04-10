import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions'

import { _logger, db } from '@nftcom/shared'

const logger = _logger.Factory('data-source', _logger.Context.SalesProcessor)

const dbConfig: Partial<PostgresConnectionOptions> = {
  host: process.env.DB_HOST || 'localhost',
  port: 5432,
  username: process.env.DB_USERNAME || 'app',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_DATABASE || 'app',
  logging: process.env.DB_LOGGING === 'true',
}

export const getConnection = async (): Promise<void> => {
  try {
    return db.connect(dbConfig)
  } catch (err) {
    logger.error(err)
    process.exit(1)
  }
}
