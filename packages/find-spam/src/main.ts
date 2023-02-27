import { intersectionBy, toLower } from 'lodash'
import fetch from 'node-fetch'
import { Pool } from 'pg'

import { checkSum } from '@nftcom/shared/helper/misc'

const pgClient = new Pool({
  user: process.env.DB_USERNAME || 'app',
  password: process.env.DB_PASSWORD || 'password',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_DATABASE || 'app',
  port: parseInt(process.env.DB_PORT || '5432'),
  ssl: {
    rejectUnauthorized: false,
  },
  max: 100,
  application_name: 'find-spam',
})

const main = async (): Promise<void> => {
  const spamFromAlchemy: string[] = await (await fetch(`https://eth-mainnet.g.alchemy.com/nft/v2/${process.env.ALCHEMY_API_KEY}/getSpamContracts`, {
    headers: {
      accept: 'application/json',
    },
  })).json()
  const notSpamFromDb: string[] = (await pgClient.query('SELECT "contract" FROM collection WHERE "isSpam" = false'))
    .rows
    .map((r) => r.contract)
  const shouldBeSpam = intersectionBy(spamFromAlchemy, notSpamFromDb, toLower)
  for (const contract of shouldBeSpam) {
    process.stdout.write(checkSum(contract) + '\n')
  }
}

main()
  .then(() => process.exit())