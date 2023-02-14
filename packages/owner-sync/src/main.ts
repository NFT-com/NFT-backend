import { BigNumber, Contract, ethers } from 'ethers'
import { Pool } from 'pg'
import { AbiItem } from 'web3-utils'

import { core } from '@nftcom/gql/service'

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

const getOwnersForContract = async (
  nftAbi: any[], nftAddress: string, _multicallContract: Contract): Promise<void> => {
  // Get tokenIds from nftAddress
  const client = await pgClient.connect()
  const tokenIds = (await client.query('SELECT "tokenId" FROM nft WHERE "contract" = $1::text', [nftAddress])).rows
  const multicallArgs = tokenIds.map(({ tokenId }) => {
    return {
      contract: nftAddress,
      name: 'ownerOf',
      params: [BigNumber.from(tokenId)],
    }
  })

  try {
    let i = 0
    for (const batch of chunk(multicallArgs, 1000)) {
      const ownersOf = await core.fetchDataUsingMulticall(batch, nftAbi, '1')
      for (const data of ownersOf) {
        await client.query(
          'UPDATE nft SET owner = $1::text WHERE "contract" = $2::text AND "tokenId" = $3::text',
          [data[0], nftAddress, tokenIds[i++].tokenId])
      }
      console.log('*'.repeat(10) + ' BATCH OF 1000 COMPLETED ' + '*'.repeat(10))
    }
  } catch (err) {
    console.log({ err, nftAddress })
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

  // Get all nftAddresses to update, then loop (or process in batches/waves/async queue)
  const contracts = (await pgClient.query('SELECT DISTINCT("contract") FROM nft WHERE "type" = \'ERC721\' AND "owner" IS NULL'))
    .rows
    .map((r) => r.contract) as string[]
  // address of ERC721 NFT
  for (const nftAddresses of chunk(contracts, 100)) {
    await Promise.allSettled(nftAddresses.map(async (nftAddress) => {
      await getOwnersForContract(nftAbi, nftAddress, multicallContract)
    }))
  }
}

main()
  .then(() => pgClient.end())
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })