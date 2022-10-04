import { Connection, ConnectionOptions, createConnection } from 'typeorm'

import { _logger, entity } from '@nftcom/shared'

const logger = _logger.Factory('sales-processor', _logger.Context.MarketplaceSale)

const dbConfig: ConnectionOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  username: process.env.DB_USERNAME || 'app',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_DATABASE || 'app',
  logging: process.env.DB_LOGGING === 'true',
  ssl: process.env.DB_USE_SSL === 'true',
  entities: [entity.MarketplaceSale],
  extra: {
    ssl: {
      ca: process.env.AWS_CA_CERT,
    },
  },
}

export const getConnection = async (): Promise<Connection> => {
  try {
    return await createConnection(dbConfig)
  } catch (err) {
    logger.error(err)
    process.exit(1)
  }
}