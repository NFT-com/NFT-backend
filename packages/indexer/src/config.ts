import 'dotenv/config'

import { helper } from '@nftcom/shared'

export const verifyConfiguration = (): void => {
  console.log('Loading configurations...')
}

export const serverPort = parseInt(process.env.PORT) || 8080
export const nodeEnv = process.env.NODE_ENV

export const isProduction = (): boolean => {
  return process.env.NODE_ENV === 'production'
}

export const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
}

export const provider = (): string => {
  const etherscanArray = process.env.ETHERSCAN_APIS.split(',')

  const maxIndex = etherscanArray.length - 1
  const minIndex = 0

  const randomIndex = (Math.random() * (maxIndex - minIndex + 1)) << 0
  return etherscanArray[randomIndex]
}

export const MAX_LOOPS = 10

export const infuraProvider = (): string => {
  const infuraArray = process.env.INFURA_API.split(',')

  const maxIndex = infuraArray.length - 1
  const minIndex = 0

  const randomIndex = (Math.random() * (maxIndex - minIndex + 1)) << 0
  return infuraArray[randomIndex]
}

export const etherscanError = ['Contract source code not verified', 'Max rate limit reached', 'Invalid API Key']
export const erc721Bytes = [
  '0x80ac58cd', // 721
  '0x780e9d63', // 721_enum
  '0x5b5e139f', // 721_meta
]
export const erc1155Bytes = ['0xd9b67a26']

export const supportsInterfaceABI = `[{
  "inputs": [
    {
      "internalType": "bytes4",
      "name": "interfaceId",
      "type": "bytes4"
    }
  ],
  "name": "supportsInterface",
  "outputs": [
    {
      "internalType": "bool",
      "name": "",
      "type": "bool"
    }
  ],
  "stateMutability": "view",
  "type": "function"
}]`

export const nftInterface = `[{
  "inputs": [],
  "name": "totalSupply",
  "outputs": [
    {
      "internalType": "uint256",
      "name": "",
      "type": "uint256"
    }
  ],
  "stateMutability": "view",
  "type": "function"
},
{
  "inputs": [
    {
      "internalType": "uint256",
      "name": "tokenId_",
      "type": "uint256"
    }
  ],
  "name": "tokenInfo",
  "outputs": [
    {
      "internalType": "uint256",
      "name": "tokenSupply",
      "type": "uint256"
    },
    {
      "internalType": "string",
      "name": "tokenUri",
      "type": "string"
    }
  ],
  "stateMutability": "view",
  "type": "function"
},
{
  "inputs": [
    {
      "internalType": "uint256",
      "name": "tokenId",
      "type": "uint256"
    }
  ],
  "name": "tokenURI",
  "outputs": [
    {
      "internalType": "string",
      "name": "",
      "type": "string"
    }
  ],
  "stateMutability": "view",
  "type": "function"
}]`

export const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  user: process.env.DB_USERNAME || 'app',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_DATABASE || 'app',
  logging: helper.parseBoolean(process.env.DB_LOGGING) || false,
  useSSL: helper.parseBoolean(process.env.DB_USE_SSL),
}
