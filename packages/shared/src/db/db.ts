import * as fs from 'fs'
import { Connection, createConnection } from 'typeorm'

import { defs } from '@nftcom/shared'

import { _logger } from '../helper'
import * as entity from './entity'
import * as repo from './repository'

const logger = _logger.Factory(_logger.Context.General)

let connection: Connection
export const connect = async (dbConfig: defs.DBConfig): Promise<void> => {
  if (connection) {
    return
  }

  const entities = [
    entity.Approval,
    entity.Bid,
    entity.Curation,
    entity.Collection,
    entity.Edge,
    entity.Event,
    entity.MarketAsk,
    entity.MarketBid,
    entity.MarketSwap,
    entity.NFT,
    entity.Profile,
    entity.User,
    entity.TxActivity,
    entity.TxBid,
    entity.TxCancel,
    entity.TxList,
    entity.TxSale,
    entity.TxTransfer,
    entity.Wallet,
  ]

  const ssl = dbConfig.useSSL
    ? { ca: fs.readFileSync(`${__dirname}/rds-combined-ca-bundle.cer`).toString() }
    : null

  return createConnection({
    type: 'postgres',
    host: dbConfig.host,
    port: dbConfig.port,
    username: dbConfig.user,
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
    .then((con) => {
      connection = con
      logger.info('Connected to database :)!!')
    })
}

export const connectTestDB = async (dbConfig: any): Promise<Connection> => {
  return await createConnection({
    type: 'postgres',
    host: dbConfig.host,
    port: dbConfig.port,
    username: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.database,
    synchronize: false,
    logging: dbConfig.logging,
    migrationsRun: true,
    migrations: [
      `${__dirname}/migration/*.ts`,
      `${__dirname}/migration/*.js`,
    ],
    cli: {
      migrationsDir: `${__dirname}/migration`,
    },
    ssl: dbConfig.useSSL,
    entities: [`${__dirname}/entity/*.entity.ts`],
    dropSchema: true,
  })
}

export const disconnect = async (): Promise<void> => {
  if (!connection) {
    return
  }
  return connection.close()
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
  marketSwap: repo.MarketSwapRepository
  nft: repo.NFTRepository
  profile: repo.ProfileRepository
  user: repo.UserRepository
  txActivity: repo.TxActivityRepository
  txBid: repo.TxBidRepository
  txCancel: repo.TxCancelRepository
  txList: repo.TxListRepository
  txSale: repo.TxSaleRepository
  txTransfer: repo.TxTransferRepository
  wallet: repo.WalletRepository
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
  marketSwap: new repo.MarketSwapRepository(),
  nft: new repo.NFTRepository(),
  profile: new repo.ProfileRepository(),
  user: new repo.UserRepository(),
  txActivity: new repo.TxActivityRepository(),
  txBid: new repo.TxBidRepository(),
  txCancel: new repo.TxCancelRepository(),
  txList: new repo.TxListRepository(),
  txSale: new repo.TxSaleRepository(),
  txTransfer: new repo.TxTransferRepository(),
  wallet: new repo.WalletRepository(),
})
