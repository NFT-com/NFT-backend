import { queue } from 'async'
import { BigNumber } from 'ethers'
import { toLower } from 'lodash'
import { Pool } from 'pg'
import { AbiItem } from 'web3-utils'
import QueryStream from 'pg-query-stream'
import { Writable } from 'stream'

import { core } from '@nftcom/gql/service'
import { entity } from '@nftcom/shared'

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
  application_name: 'owner-sync',
})

const chunk = (arr: any[], size: number): any[] => {
  const chunks: any[] = []
  while (arr.length) {
    chunks.push(arr.splice(0, size))
  }
  return chunks
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getOwnersForContract = async (nftAbi: any[], nftAddress: string): Promise<number> => {
  // Get tokenIds from nftAddress
  const client = await pgClient.connect()
  const tokenIds: entity.NFT[] = (
    await client.query('SELECT "tokenId" FROM nft WHERE "contract" = $1::text AND "owner" IS NULL', [nftAddress])
  ).rows
  const multicallArgs = tokenIds.map(({ tokenId }) => {
    return {
      contract: nftAddress,
      name: 'ownerOf',
      params: [BigNumber.from(tokenId)],
    }
  })

  try {
    for (const batch of chunk(multicallArgs, 1000)) {
      const ownersOf = await core.fetchDataUsingMulticall(batch, nftAbi, '1')
      for (const [i, data] of ownersOf.entries()) {
        if (!data) continue
        await client.query(
          'UPDATE nft SET owner = $1::text, "updatedAt" = Now() WHERE "contract" = $2::text AND "tokenId" = $3::text',
          [data[0], tokenIds[i].contract, tokenIds[i].tokenId],
        )
      }
      console.log('*'.repeat(10) + ` BATCH OF ${batch.length} COMPLETED ` + '*'.repeat(10))
    }
  } catch (err) {
    console.log(err)
  }
  client.release()
  return tokenIds.length
}

const getOwnersForNFTs = async (nftAbi: any[], nfts: Partial<entity.NFT>[]): Promise<number> => {
  const client = await pgClient.connect()
  const multicallArgs = nfts.map(({ tokenId, contract }) => {
    return {
      contract,
      name: 'ownerOf',
      params: [BigNumber.from(tokenId)],
    }
  })

  let length
  try {
    const ownersOf = await core.fetchDataUsingMulticall(multicallArgs, nftAbi, '1')
    const vals = []
    for (const [i, data] of ownersOf.entries()) {
      if (!data) continue
      vals.push(`('${nfts[i].id}', '${data[0]}')`)
    }
    if (vals.length) {
      await client.query(`
      UPDATE nft SET "owner" = vals."owner", "updatedAt" = Now()
      FROM (
        VALUES
        ${vals.join(', ')}
      ) AS vals ("id", "owner")
      WHERE nft."id" = vals."id"`)
      console.log('*'.repeat(10) + ` BATCH OF ${ownersOf.length} COMPLETED ` + '*'.repeat(10))
    }
    length = ownersOf.length
  } catch (err) {
    console.log(err)
  }
  client.release()
  return length || 0
}

const main = async (shouldSeparateContracts = false): Promise<void> => {
  // ERC721 abi to interact with contract
  const nftAbi: AbiItem[] = [
    {
      inputs: [
        {
          internalType: 'uint256',
          name: 'tokenId',
          type: 'uint256',
        },
      ],
      name: 'ownerOf',
      outputs: [
        {
          internalType: 'address',
          name: '',
          type: 'address',
        },
      ],
      stateMutability: 'view',
      type: 'function',
    },
  ]

  const spamFromAlchemy: string[] = await (
    await fetch(`https://eth-mainnet.g.alchemy.com/nft/v2/${process.env.ALCHEMY_API_KEY}/getSpamContracts`, {
      headers: {
        accept: 'application/json',
      },
    })
  ).json()

  if (shouldSeparateContracts) {
    const contracts: Partial<entity.NFT>[] = (
      await pgClient.query(`
      SELECT DISTINCT "contract"
      FROM nft 
      WHERE 
        "type" = 'ERC721' 
        AND "owner" IS NULL
        AND "contract" IN (
          SELECT "contract" FROM collection WHERE "isSpam" = false
        )`)
    ).rows
      .filter(nft => !spamFromAlchemy.includes(toLower(nft.contract)))
      .map(nft => nft.contract)
    const q = queue(async (contractAddress: string) => {
      const batchSize = await getOwnersForContract(nftAbi, contractAddress)
      return { contractAddress, batchSize, remaining: q.length() }
    }, 100)

    q.push(contracts, (err, task) => {
      if (err) {
        console.error(err)
        return
      }
      console.info(task)
    })

    await q.drain()
  } else {
    const q = queue(async (nfts: Partial<entity.NFT>[]) => {
      const batchSize = await getOwnersForNFTs(nftAbi, nfts)
      // await getOwnersForContract(nftAbi, contractAddress, multicallContract)
      return { contractAddresses: new Set(nfts.map(n => n.contract)), batchSize, remaining: q.length() }
    }, 20)

    const pushBatchToQueue = (batch: Partial<entity.NFT>[]) => {
      q.push([batch], (err, task) => {
        if (err) {
          console.error(err)
          return
        }
        console.info(task)
      })
    }

    await new Promise<void>((resolve, reject) => {
      pgClient.connect((err, client, done) => {
        if (err) throw err
        const batch = []
        const batchSize = 100
        const query = new QueryStream(
          `SELECT "id", "contract", "tokenId"
          FROM nft 
          WHERE 
            "type" = 'ERC721' 
            AND "owner" IS NULL
            AND "contract" IN (
              SELECT "contract" FROM collection WHERE "isSpam" = false
            )`,
          [],
          { batchSize, highWaterMark: 1_000_000 },
        )
        const stream = client.query(query)
        stream.on('end', async () => {
          if (batch.length) {
            pushBatchToQueue(batch.splice(0))
          }
          done()
          resolve()
        })
        stream.on('error', err => {
          reject(err)
        })
        const processBatch = new Writable({
          objectMode: true,
          async write(nft, _encoding, callback) {
            if (!spamFromAlchemy.includes(toLower(nft.contract))) {
              batch.push(nft)
            }
            if (batch.length === batchSize) {
              pushBatchToQueue(batch.splice(0, batchSize))
            }
            callback()
          },
        })
        stream.pipe(processBatch)
      })
    })

    await q.drain()
  }
}

// run main(true) to sync collection-by-collection
main()
  .then(() => pgClient.end())
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
