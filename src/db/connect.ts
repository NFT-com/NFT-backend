import { Connection, createConnection } from 'typeorm'

import { dbConfig } from '@src/config'
import * as entity from '@src/db/entity'

let connection: Connection
export const connect = async (): Promise<void> => {
  if (connection) {
    return
  }

  const entities = [
    entity.Approval,
    entity.Bid,
    entity.Edge,
    entity.NFT,
    entity.Profile,
    entity.User,
    entity.Wallet,
  ]

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
      `${dbConfig.migrationDirectory}/*.ts`,
      `${dbConfig.migrationDirectory}/*.js`,
    ],
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
