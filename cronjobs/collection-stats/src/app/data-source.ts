import { DataSourceOptions } from 'typeorm'

import { _logger, db, entity } from '@nftcom/shared'

const logger = _logger.Factory('data-source', _logger.Context.CollectionStats)

const dbConfig: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: (process.env.DB_PORT && parseInt(process.env.DB_PORT)) || 5432,
  username: process.env.DB_USERNAME || 'app',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_DATABASE || 'app',
  logging: process.env.DB_LOGGING === 'true',
  ssl: process.env.DB_USE_SSL === 'true',
  entities: [entity.Collection],
  extra: {
    ssl: {
      ca: process.env.AWS_CA_CERT,
    },
  },
}

export const getConnection = async (): Promise<void> => {
  try {
    return db.connect(dbConfig)
  } catch (err) {
    logger.error(err)
    process.exit(1)
  }
}