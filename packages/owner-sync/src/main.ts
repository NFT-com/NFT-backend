import { queue } from 'async'
import { BigNumber, Contract, ethers } from 'ethers'
import { toLower } from 'lodash'
import { Pool } from 'pg'
import { AbiItem } from 'web3-utils'
import QueryStream from 'pg-query-stream'
import { Writable } from 'stream'

import { core } from '@nftcom/gql/service'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { defs, entity } from '@nftcom/shared'

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
  application_name: 'semper',
})

// Assign a default web3 provider
const provider = new ethers.providers.AlchemyProvider(1, process.env.ALCHEMY_API_KEY)
const wallet = new ethers.Wallet('a2f890d2f7023d5eeba7f5c600bd50650ca59bd7e7007af8e016cd7abdc9af5d', provider)
const signer = wallet.connect(provider)

const chunk = (arr: any[], size: number): any[] => {
  const chunks: any[] = []
  while (arr.length) {
    chunks.push(arr.splice(0, size))
  }
  return chunks
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getOwnersForContract = async (
  nftAbi: any[], nftAddress: string, _multicallContract: Contract): Promise<void> => {
  // Get tokenIds from nftAddress
  const client = await pgClient.connect()
  const tokenIds: entity.NFT[] = (await client.query('SELECT "tokenId" FROM nft WHERE "contract" = $1::text AND "owner" IS NULL', [nftAddress])).rows
  const multicallArgs = tokenIds.map(({ tokenId, contract }) => {
    return {
      contract,
      name: 'ownerOf',
      params: [BigNumber.from(tokenId)],
    }
  })

  try {
    let i = 0
    for (const batch of chunk(multicallArgs, 1000)) {
      const ownersOf = await core.fetchDataUsingMulticall(batch, nftAbi, '1')
      for (const data of ownersOf) {
        if (!data) continue
        await client.query(
          'UPDATE nft SET owner = $1::text WHERE "contract" = $2::text AND "tokenId" = $3::text',
          [data[0], tokenIds[i++].contract, tokenIds[i++].tokenId])
      }
      console.log('*'.repeat(10) + ` BATCH OF ${batch.length} COMPLETED ` + '*'.repeat(10))
    }
  } catch (err) {
    console.log(err)
  }
  client.release()
}

const getOwnersForNFTs = async (
  nftAbi: any[], nfts: Partial<entity.NFT>[], _multicallContract: Contract): Promise<void> => {
  const client = await pgClient.connect()
  const multicallArgs = nfts.map(({ tokenId, contract }) => {
    const callData = {
      contract,
      name: 'ownerOf',
      params: [BigNumber.from(tokenId)],
    }
    return callData
  })

  try {
    const ownersOf = await core.fetchDataUsingMulticall(multicallArgs, nftAbi, '1')
    const vals = []
    for (let i = 0; i < ownersOf.length; i++) {
      const data = ownersOf[0]
      if (!data) continue
      vals.push(`('${nfts[i].id}', '${data[0]}')`)
    }
    await client.query(`
      UPDATE nft SET "owner" = vals.owner, "updatedAt" = Now()
      FROM (
        VALUES
        ${vals.join(', ')}
      ) AS vals ("id", "owner")
      WHERE nft."id" = vals."id"`)
    console.log('*'.repeat(10) + ` BATCH OF ${ownersOf.length} COMPLETED ` + '*'.repeat(10))
  } catch (err) {
    console.log(err)
  }
  client.release()
}

const main = async (): Promise<void> => {
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

  // address of multicall contract for ETH mainnet
  const multicallAddress = '0xcA11bde05977b3631167028862bE2a173976CA11'
  // multicall abi to interact with contract
  const multicallAbi = [{ 'inputs': [{ 'components': [{ 'internalType': 'address', 'name': 'target', 'type': 'address' }, { 'internalType': 'bytes', 'name': 'callData', 'type': 'bytes' }], 'internalType': 'struct Multicall3.Call[]', 'name': 'calls', 'type': 'tuple[]' }], 'name': 'aggregate', 'outputs': [{ 'internalType': 'uint256', 'name': 'blockNumber', 'type': 'uint256' }, { 'internalType': 'bytes[]', 'name': 'returnData', 'type': 'bytes[]' }], 'stateMutability': 'payable', 'type': 'function' }, { 'inputs': [{ 'components': [{ 'internalType': 'address', 'name': 'target', 'type': 'address' }, { 'internalType': 'bool', 'name': 'allowFailure', 'type': 'bool' }, { 'internalType': 'bytes', 'name': 'callData', 'type': 'bytes' }], 'internalType': 'struct Multicall3.Call3[]', 'name': 'calls', 'type': 'tuple[]' }], 'name': 'aggregate3', 'outputs': [{ 'components': [{ 'internalType': 'bool', 'name': 'success', 'type': 'bool' }, { 'internalType': 'bytes', 'name': 'returnData', 'type': 'bytes' }], 'internalType': 'struct Multicall3.Result[]', 'name': 'returnData', 'type': 'tuple[]' }], 'stateMutability': 'payable', 'type': 'function' }, { 'inputs': [{ 'components': [{ 'internalType': 'address', 'name': 'target', 'type': 'address' }, { 'internalType': 'bool', 'name': 'allowFailure', 'type': 'bool' }, { 'internalType': 'uint256', 'name': 'value', 'type': 'uint256' }, { 'internalType': 'bytes', 'name': 'callData', 'type': 'bytes' }], 'internalType': 'struct Multicall3.Call3Value[]', 'name': 'calls', 'type': 'tuple[]' }], 'name': 'aggregate3Value', 'outputs': [{ 'components': [{ 'internalType': 'bool', 'name': 'success', 'type': 'bool' }, { 'internalType': 'bytes', 'name': 'returnData', 'type': 'bytes' }], 'internalType': 'struct Multicall3.Result[]', 'name': 'returnData', 'type': 'tuple[]' }], 'stateMutability': 'payable', 'type': 'function' }, { 'inputs': [{ 'components': [{ 'internalType': 'address', 'name': 'target', 'type': 'address' }, { 'internalType': 'bytes', 'name': 'callData', 'type': 'bytes' }], 'internalType': 'struct Multicall3.Call[]', 'name': 'calls', 'type': 'tuple[]' }], 'name': 'blockAndAggregate', 'outputs': [{ 'internalType': 'uint256', 'name': 'blockNumber', 'type': 'uint256' }, { 'internalType': 'bytes32', 'name': 'blockHash', 'type': 'bytes32' }, { 'components': [{ 'internalType': 'bool', 'name': 'success', 'type': 'bool' }, { 'internalType': 'bytes', 'name': 'returnData', 'type': 'bytes' }], 'internalType': 'struct Multicall3.Result[]', 'name': 'returnData', 'type': 'tuple[]' }], 'stateMutability': 'payable', 'type': 'function' }, { 'inputs': [], 'name': 'getBasefee', 'outputs': [{ 'internalType': 'uint256', 'name': 'basefee', 'type': 'uint256' }], 'stateMutability': 'view', 'type': 'function' }, { 'inputs': [{ 'internalType': 'uint256', 'name': 'blockNumber', 'type': 'uint256' }], 'name': 'getBlockHash', 'outputs': [{ 'internalType': 'bytes32', 'name': 'blockHash', 'type': 'bytes32' }], 'stateMutability': 'view', 'type': 'function' }, { 'inputs': [], 'name': 'getBlockNumber', 'outputs': [{ 'internalType': 'uint256', 'name': 'blockNumber', 'type': 'uint256' }], 'stateMutability': 'view', 'type': 'function' }, { 'inputs': [], 'name': 'getChainId', 'outputs': [{ 'internalType': 'uint256', 'name': 'chainid', 'type': 'uint256' }], 'stateMutability': 'view', 'type': 'function' }, { 'inputs': [], 'name': 'getCurrentBlockCoinbase', 'outputs': [{ 'internalType': 'address', 'name': 'coinbase', 'type': 'address' }], 'stateMutability': 'view', 'type': 'function' }, { 'inputs': [], 'name': 'getCurrentBlockDifficulty', 'outputs': [{ 'internalType': 'uint256', 'name': 'difficulty', 'type': 'uint256' }], 'stateMutability': 'view', 'type': 'function' }, { 'inputs': [], 'name': 'getCurrentBlockGasLimit', 'outputs': [{ 'internalType': 'uint256', 'name': 'gaslimit', 'type': 'uint256' }], 'stateMutability': 'view', 'type': 'function' }, { 'inputs': [], 'name': 'getCurrentBlockTimestamp', 'outputs': [{ 'internalType': 'uint256', 'name': 'timestamp', 'type': 'uint256' }], 'stateMutability': 'view', 'type': 'function' }, { 'inputs': [{ 'internalType': 'address', 'name': 'addr', 'type': 'address' }], 'name': 'getEthBalance', 'outputs': [{ 'internalType': 'uint256', 'name': 'balance', 'type': 'uint256' }], 'stateMutability': 'view', 'type': 'function' }, { 'inputs': [], 'name': 'getLastBlockHash', 'outputs': [{ 'internalType': 'bytes32', 'name': 'blockHash', 'type': 'bytes32' }], 'stateMutability': 'view', 'type': 'function' }, { 'inputs': [{ 'internalType': 'bool', 'name': 'requireSuccess', 'type': 'bool' }, { 'components': [{ 'internalType': 'address', 'name': 'target', 'type': 'address' }, { 'internalType': 'bytes', 'name': 'callData', 'type': 'bytes' }], 'internalType': 'struct Multicall3.Call[]', 'name': 'calls', 'type': 'tuple[]' }], 'name': 'tryAggregate', 'outputs': [{ 'components': [{ 'internalType': 'bool', 'name': 'success', 'type': 'bool' }, { 'internalType': 'bytes', 'name': 'returnData', 'type': 'bytes' }], 'internalType': 'struct Multicall3.Result[]', 'name': 'returnData', 'type': 'tuple[]' }], 'stateMutability': 'payable', 'type': 'function' }, { 'inputs': [{ 'internalType': 'bool', 'name': 'requireSuccess', 'type': 'bool' }, { 'components': [{ 'internalType': 'address', 'name': 'target', 'type': 'address' }, { 'internalType': 'bytes', 'name': 'callData', 'type': 'bytes' }], 'internalType': 'struct Multicall3.Call[]', 'name': 'calls', 'type': 'tuple[]' }], 'name': 'tryBlockAndAggregate', 'outputs': [{ 'internalType': 'uint256', 'name': 'blockNumber', 'type': 'uint256' }, { 'internalType': 'bytes32', 'name': 'blockHash', 'type': 'bytes32' }, { 'components': [{ 'internalType': 'bool', 'name': 'success', 'type': 'bool' }, { 'internalType': 'bytes', 'name': 'returnData', 'type': 'bytes' }], 'internalType': 'struct Multicall3.Result[]', 'name': 'returnData', 'type': 'tuple[]' }], 'stateMutability': 'payable', 'type': 'function' }]

  const multicallContract = new Contract(multicallAddress, multicallAbi, signer)

  const spamFromAlchemy: string[] = await (await fetch(`https://eth-mainnet.g.alchemy.com/nft/v2/${process.env.ALCHEMY_API_KEY}/getSpamContracts`, {
    headers: {
      accept: 'application/json',
    },
  })).json()
  // Get all nftAddresses to update, then loop (or process in batches/waves/async queue)
  // const nfts: Partial<entity.NFT>[] = (await pgClient.query(`
  // SELECT "id", "contract", "tokenId"
  // FROM nft 
  // WHERE 
  //   "type" = 'ERC721' 
  //   AND "owner" IS NULL
  //   AND "contract" IN (
  //     SELECT "contract" FROM collection WHERE "isSpam" = false
  //   )
  //   LIMIT 1000
  // `))
  //   .rows
  //   .filter((nft) => !spamFromAlchemy.includes(toLower(nft.contract)))
  //   .filter((c) => !defs.LARGE_COLLECTIONS.includes(c.contract))
  //   .map((c) => c.contract)
  // contracts.unshift(...defs.LARGE_COLLECTIONS)

  const q = queue(async (nfts: Partial<entity.NFT>[]) => {
    await getOwnersForNFTs(nftAbi, nfts, multicallContract)
    // await getOwnersForContract(nftAbi, contractAddress, multicallContract)
    return { contractAddresses: new Set(nfts.map((n) => n.contract)), remaining: q.length() }
  }, 1)

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
      const batchSize = 1000
      const query = new QueryStream(
        `SELECT "id", "contract", "tokenId"
        FROM nft 
        WHERE 
          "type" = 'ERC721' 
          AND "owner" IS NULL
          AND "contract" IN (
            SELECT "contract" FROM collection WHERE "isSpam" = false
          )`, [], { batchSize, highWaterMark: 1_000_000 },
      )
      const stream = client.query(query)
      stream.on('end', async () => {
        if (batch.length) {
          pushBatchToQueue(batch.splice(0))
        }
        done()
        resolve()
      })
      stream.on('error', (err) => {
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

main()
  .then(() => pgClient.end())
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })