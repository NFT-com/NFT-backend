import fs from 'fs'
import { DataSource } from 'typeorm'

import { helper } from '../helper'

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 10030,
  username: process.env.DB_USERNAME || 'app',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_DATABASE || 'app',
  logging: helper.parseBoolean(process.env.DB_LOGGING) || false,
}

const ssl = helper.parseBoolean(process.env.DB_USE_SSL)
  ? { ca: fs.readFileSync(`${__dirname}/rds-combined-ca-bundle.cer`).toString() }
  : null

export default new DataSource({
  type: 'postgres',
  host: dbConfig.host,
  port: dbConfig.port,
  username: dbConfig.username,
  password: dbConfig.password,
  database: dbConfig.database,
  synchronize: false,
  logging: dbConfig.logging,
  migrationsRun: true,
  migrations: [`${__dirname}/migration/*.ts`, `${__dirname}/migration/*.js`],
  ssl,
  entities: [`${__dirname}/entity/*.entity.ts`],
  subscribers: [`${__dirname}/subscriber/*.subscriber.ts`],
})
