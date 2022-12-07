import * as fs from 'fs'
import { DataSource } from 'typeorm'
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions'

import { _logger, helper } from '../helper'
import * as entity from './entity'
import * as repo from './repository'

const {
  DB_HOST,
  DB_HOST_RO,
  DB_USE_SSL,
} = process.env

const logger = _logger.Factory(_logger.Context.General)

let connection: DataSource
let readOnlyConnection: DataSource
export const getDataSource = (isReadOnly?: boolean): DataSource => {
  if (isReadOnly) {
    if (!readOnlyConnection) {
      throw new Error('No read-only database connection')
    }
    return readOnlyConnection
  }
  if (!connection) {
    throw new Error('No database connection')
  }
  return connection
}

export const connect = async (dbConfig: Partial<PostgresConnectionOptions>): Promise<void> => {
  if (connection) {
    return
  }

  const ssl = helper.parseBoolean(DB_USE_SSL)
    ? {
      ca: fs.readFileSync(`${__dirname}/rds-combined-ca-bundle.cer`).toString(),
      rejectUnauthorized: DB_HOST !== 'localhost',
    }
    : null

  const entities = [
    entity.Approval,
    entity.Bid,
    entity.Curation,
    entity.Collection,
    entity.Edge,
    entity.Event,
    entity.MarketAsk,
    entity.MarketBid,
    entity.MarketplaceSale,
    entity.MarketSwap,
    entity.NFT,
    entity.Profile,
    entity.User,
    entity.TxActivity,
    entity.TxCancel,
    entity.TxOrder,
    entity.TxTransaction,
    entity.Wallet,
    entity.IncentiveAction,
  ]

  const defaultDataSource = new DataSource({
    type: 'postgres',
    poolSize: 20,
    host: dbConfig.host,
    port: dbConfig.port,
    username: dbConfig.username,
    password: dbConfig.password,
    database: dbConfig.database,
    synchronize: false,
    logging: dbConfig.logging,
    migrationsRun: true,
    migrations: [
      `${__dirname}/migration/*.ts`,
      `${__dirname}/migration/*.js`,
    ],
    ssl,
    entities,
  })

  const readOnlyDbConfig = {
    ...dbConfig,
    host: DB_HOST_RO || dbConfig.host,
  }

  const readOnlyDataSource = new DataSource({
    type: 'postgres',
    poolSize: 20,
    host: readOnlyDbConfig.host,
    port: readOnlyDbConfig.port,
    username: readOnlyDbConfig.username,
    password: readOnlyDbConfig.password,
    database: readOnlyDbConfig.database,
    synchronize: false,
    logging: readOnlyDbConfig.logging,
    ssl,
    entities,
  })

  return Promise.all([defaultDataSource.initialize(), readOnlyDataSource.initialize()])
    .then(([defaultConnection, roConnection]) => {
      connection = defaultConnection
      readOnlyConnection = roConnection
      logger.info('Connected to database :)!!')
    })
}

export const connectTestDB = async (dbConfig: Partial<PostgresConnectionOptions>): Promise<DataSource> => {
  return new DataSource({
    type: 'postgres',
    host: dbConfig.host,
    port: dbConfig.port,
    username: dbConfig.username,
    password: dbConfig.password,
    database: dbConfig.database,
    logging: dbConfig.logging,
    synchronize: false,
    migrationsRun: true,
    migrations: [
      `${__dirname}/migration/*.ts`,
      `${__dirname}/migration/*.js`,
    ],
    ssl: helper.parseBoolean(process.env.DB_USE_SSL),
    entities: [`${__dirname}/entity/*.entity.ts`],
    dropSchema: true,
  }).initialize()
    .then((con) => {
      connection = con
      readOnlyConnection = con
      return con
    })
}

export const disconnect = async (): Promise<void> => {
  if (!connection) {
    return
  }
  await Promise.all([connection.destroy(), readOnlyConnection.destroy()])
}

export type Repository = {
  approval: repo.ApprovalRepository
  bid: repo.BidRepository
  curation: repo.CurationRepository
  collection: repo.CollectionRepository
  edge: repo.EdgeRepository
  event: repo.EventRepository
  marketAsk: repo.MarketAskRepository
  marketBid: repo.MarketBidRepository
  marketplaceSale: repo.MarketplaceSaleRepository
  marketSwap: repo.MarketSwapRepository
  nft: repo.NFTRepository
  profile: repo.ProfileRepository
  user: repo.UserRepository
  txActivity: repo.TxActivityRepository
  txCancel: repo.TxCancelRepository
  txOrder: repo.TxOrderRepository
  txTransaction: repo.TxTransactionRepository
  wallet: repo.WalletRepository
  incentiveAction: repo.IncentiveActionRepository
}

export const newRepositories = (): Repository => ({
  approval: new repo.ApprovalRepository(),
  bid: new repo.BidRepository(),
  curation: new repo.CurationRepository(),
  collection: new repo.CollectionRepository(),
  edge: new repo.EdgeRepository(),
  event: new repo.EventRepository(),
  marketAsk: new repo.MarketAskRepository(),
  marketBid: new repo.MarketBidRepository(),
  marketplaceSale: new repo.MarketplaceSaleRepository(),
  marketSwap: new repo.MarketSwapRepository(),
  nft: new repo.NFTRepository(),
  profile: new repo.ProfileRepository(),
  user: new repo.UserRepository(),
  txActivity: new repo.TxActivityRepository(),
  txCancel: new repo.TxCancelRepository(),
  txOrder: new repo.TxOrderRepository(),
  txTransaction: new repo.TxTransactionRepository(),
  wallet: new repo.WalletRepository(),
  incentiveAction: new repo.IncentiveActionRepository(),
})
