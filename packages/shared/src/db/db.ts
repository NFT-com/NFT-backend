import * as fs from 'fs'
import { Connection, createConnection } from 'typeorm'

import { DBConfig } from '@nftcom/shared/defs'

import * as entity from './entity'
import * as repo from './repository'

let connection: Connection
export const connect = async (dbConfig: DBConfig): Promise<void> => {
  if (connection) {
    return
  }

  const entities = [
    entity.Approval,
    entity.Bid,
    entity.Collection,
    entity.ContractInfo,
    entity.Edge,
    entity.NFT,
    entity.NFTRaw,
    entity.NFTTrade,
    entity.Profile,
    entity.User,
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
      console.log('Connected to database :)!!')
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
  collection: repo.CollectionRepository
  contractInfo: repo.ContractInfoRepository
  edge: repo.EdgeRepository
  nft: repo.NFTRepository
  nftRaw: repo.NFTRawRepository
  nftTrade: repo.NFTTradeRepository
  profile: repo.ProfileRepository
  user: repo.UserRepository
  wallet: repo.WalletRepository
}

export const newRepositories = (): Repository => ({
  approval: new repo.ApprovalRepository(),
  bid: new repo.BidRepository(),
  collection: new repo.CollectionRepository(),
  contractInfo: new repo.ContractInfoRepository(),
  edge: new repo.EdgeRepository(),
  nft: new repo.NFTRepository(),
  nftRaw: new repo.NFTRawRepository(),
  nftTrade: new repo.NFTTradeRepository(),
  profile: new repo.ProfileRepository(),
  user: new repo.UserRepository(),
  wallet: new repo.WalletRepository(),
})
