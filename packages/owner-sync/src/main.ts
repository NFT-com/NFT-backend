import { BigNumber } from 'ethers'
import { AbiCoder } from 'ethers/lib/utils'
import { Pool } from 'pg'
import Web3 from 'web3'
import { Contract } from 'web3-eth-contract'
import { AbiItem } from 'web3-utils'

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
let web3 = new Web3(new Web3.providers.HttpProvider('https://eth.llamarpc.com'))

// List of our web3 providers
const providers = [
  new Web3(new Web3.providers.HttpProvider('https://eth.llamarpc.com')),
  new Web3(new Web3.providers.HttpProvider('https://rpc.ankr.com/eth')),
  new Web3(new Web3.providers.HttpProvider('https://cloudflare-eth.com/')),
  new Web3(new Web3.providers.HttpProvider('https://rpc.flashbots.net/')),
  new Web3(new Web3.providers.HttpProvider('https://eth-mainnet.public.blastapi.io')),
  new Web3(new Web3.providers.HttpProvider('https://nodes.mewapi.io/rpc/eth')),
  new Web3(new Web3.providers.HttpProvider('https://eth-mainnet.gateway.pokt.network/v1/5f3453978e354ab992c4da79')),
  new Web3(new Web3.providers.HttpProvider('https://eth-mainnet.nodereal.io/v1/1659dfb40aa24bbb8153a677b98064d7')),
  new Web3(new Web3.providers.HttpProvider('https://ethereum.publicnode.com')),
]

// Selects the first web3 provider available from our list
const providerSelector = async (): Promise<boolean> => {
  let selectedProvider: Web3 | null = null
  for (let i = 1; i < providers.length; i++) {
    await providers[i].eth.getBlockNumber()
      .then(() => { selectedProvider = providers[i] })
      .catch(() => { console.log(`Provider ${providers[i]} not available`) })
    if (selectedProvider) {
      web3 = selectedProvider
      providers.concat(providers.splice(0, i))
      return true
    }
  }
  return false
}

const chunk = (arr: any[], size: number): any[] => {
  const chunks: any[] = []
  while (arr.length) {
    chunks.push(arr.splice(0, size))
  }
  return chunks
}

const getOwnersForContract = async (
  nftAbi: AbiItem[], nftAddress: string, multicallContract: Contract): Promise<void> => {
  const nftContract = new web3.eth.Contract(nftAbi, nftAddress)

  // Get tokenIds from nftAddress
  const client = await pgClient.connect()
  const tokenIds = (await client.query('SELECT "tokenId" FROM nft WHERE "contract" = $1::text', [nftAddress])).rows
  const multicallArgs = tokenIds.map(({ tokenId }) => {
    const callData = nftContract.methods['ownerOf'](BigNumber.from(tokenId).toBigInt()).encodeABI()
    return {
      target: nftAddress,
      callData: callData,
    }
  })
  // call multicall. The multicallArgs will call the NFT contract
  // and return the ownersOf token id 1,2,3
  try {
    const abiCoder = new AbiCoder()
    let i = 0
    for (const batch of chunk(multicallArgs, 1000)) {
      const ownersOf = await multicallContract.methods['aggregate'](
        batch,
      ).call()
      for (const data of ownersOf.returnData) {
        await client.query(
          'UPDATE nft SET owner = $1::text WHERE "contract" = $2::text AND "tokenId" = $3::text',
          [abiCoder.decode(['address'], data)[0], nftAddress, tokenIds[i++].tokenId])
      }
    }
  } catch (err) {
    // If current provider is not available, try another one from the list
    const res = JSON.stringify(err, Object.getOwnPropertyNames(err))
    if (res.includes('Invalid JSON RPC response'))
      (await providerSelector()) ? getOwnersForContract(nftAbi, nftAddress, multicallContract) : console.log('No providers available')
    console.log(res)
  } finally {
    client.release()
  }
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
  const multicallAddress = '0xeefba1e63905ef1d7acba5a8513c70307c1ce441'
  // multicall abi to interact with contract
  const multicallAbi: AbiItem[] = [
    {
      constant: false,
      inputs: [
        {
          components: [
            { name: 'target', type: 'address' },
            { name: 'callData', type: 'bytes' },
          ],
          name: 'calls',
          type: 'tuple[]',
        },
      ],
      name: 'aggregate',
      outputs: [
        { name: 'blockNumber', type: 'uint256' },
        { name: 'returnData', type: 'bytes[]' },
      ],
      payable: false,
      stateMutability: 'nonpayable',
      type: 'function',
    },
  ]

  // interact with multicall contract
  const multicallContract = new web3.eth.Contract(
    multicallAbi,
    multicallAddress,
  )

  // Get all nftAddresses to update, then loop (or process in batches/waves/async queue)
  const contracts = (await pgClient.query('SELECT DISTINCT("contract") FROM nft WHERE "type" = \'ERC721\''))
    .rows
    .map((r) => r.contract) as string[]
  // address of ERC721 NFT
  for (const nftAddress of contracts) {
    await getOwnersForContract(nftAbi, nftAddress, multicallContract)
  }
}

main()
  .then(() => pgClient.end())