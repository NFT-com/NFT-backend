import fetch from 'node-fetch'
import { Pool } from 'pg'

import { checkSum } from '@nftcom/shared/helper/misc'

const pgClient = new Pool({
  user: process.env.DB_USERNAME || 'app',
  password: process.env.DB_PASSWORD || 'password',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_DATABASE || 'app',
  port: parseInt('5432'),
  ssl: {
    rejectUnauthorized: false,
  },
  max: 100,
  application_name: 'owner-sync-fix-type',
})

const main = async (): Promise<void> => {
  const contracts: string[] = (
    await pgClient.query(
      'SELECT DISTINCT "contract" FROM nft WHERE "type" != \'ERC1155\' AND "contract" IN (SELECT "contract" FROM "collection" WHERE "isSpam" = false)',
    )
  ).rows.map(r => r.contract)
  for (const contract of contracts) {
    const resp = await (
      await fetch(
        `https://eth-mainnet.g.alchemy.com/nft/v2/${
          process.env.ALCHEMY_API_KEY
        }/getContractMetadata?contractAddress=${contract.toLowerCase()}`,
        {
          headers: {
            accept: 'application/json',
          },
        },
      )
    ).json()
    if (resp?.contractMetadata?.tokenType === 'ERC1155') {
      await pgClient.query('UPDATE nft SET "type" = \'ERC1155\', "updatedAt" = Now() WHERE "contract" = $1', [
        checkSum(contract),
      ])
    }
    process.stdout.write('.')
  }
}

main().then(() => process.exit())
