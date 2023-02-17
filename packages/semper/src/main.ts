import { Pool } from 'pg'
import Typesense from 'typesense'

import { db, helper } from '@nftcom/shared'

import Commander from './app/search/commander'

const TYPESENSE_HOST = process.env.TYPESENSE_HOST
const TYPESENSE_PORT = parseInt(process.env.TYPESENSE_PORT) || 443
const TYPESENSE_PROTOCOL = process.env.TYPESENSE_PROTOCOL || 'https'
const TYPESENSE_API_KEY = process.env.TYPESENSE_API_KEY

const typesenseClient = new Typesense.Client({
  nodes: [
    {
      host: TYPESENSE_HOST,
      port: TYPESENSE_PORT,
      protocol: TYPESENSE_PROTOCOL,
    },
  ],
  apiKey: TYPESENSE_API_KEY,
  connectionTimeoutSeconds: 3600, // 1 hour... because typesense
})

const pgClient = new Pool({
  user: process.env.DB_USERNAME || 'app',
  password: process.env.DB_PASSWORD || 'password',
  host: process.env.DB_HOST_RO || 'localhost',
  database: process.env.DB_DATABASE || 'app',
  port: parseInt(process.env.DB_PORT) || 5432,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 100,
  application_name: 'semper',
})

export const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  username: process.env.DB_USERNAME || 'app',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_DATABASE || 'app',
  logging: helper.parseBoolean(process.env.DB_LOGGING) || false,
  useSSL: helper.parseBoolean(process.env.DB_USE_SSL),
}

const main = async (): Promise<void> => {
  await db.connect(dbConfig)
  pgClient.connect()
  const repositories = db.newRepositories()
  const commander = new Commander(typesenseClient, repositories, pgClient)
  
  await commander.help()
  // await commander.erase()
  // await commander.restore()
  // await commander.erase()
  // await commander.update('collections', ['issuance'], [])
  // await commander.update('nfts', ['isProfileGKMinted'], ['isProfileGKMinted'])
  // await commander.reindexNFTsByContract('0xa3AEe8BcE55BEeA1951EF834b99f3Ac60d1ABeeB', await commander.retrieveListings({ nftContract: '0xa3AEe8BcE55BEeA1951EF834b99f3Ac60d1ABeeB' }))

  await db.disconnect()
}

main().then(() => process.exit())
