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
    entity.Curation,
    entity.Edge,
    entity.Event,
    entity.NFT,
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
  curation: repo.CurationRepository
  edge: repo.EdgeRepository
  event: repo.EventRepository
  nft: repo.NFTRepository
  profile: repo.ProfileRepository
  user: repo.UserRepository
  wallet: repo.WalletRepository
}

export const newRepositories = (): Repository => ({
  approval: new repo.ApprovalRepository(),
  bid: new repo.BidRepository(),
  curation: new repo.CurationRepository(),
  edge: new repo.EdgeRepository(),
  event: new repo.EventRepository(),
  nft: new repo.NFTRepository(),
  profile: new repo.ProfileRepository(),
  user: new repo.UserRepository(),
  wallet: new repo.WalletRepository(),
})
