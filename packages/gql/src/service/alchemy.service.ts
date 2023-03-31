import axios from 'axios'
import { ethers } from 'ethers'

import { cache } from '@nftcom/cache'
import { _logger } from '@nftcom/shared'
import * as Sentry from '@sentry/node'

const logger = _logger.Factory('alchemy.service', _logger.Context.GraphQL)

const ALCHEMY_API_URL = process.env.ALCHEMY_API_URL
const ALCHEMY_API_URL_GOERLI = process.env.ALCHEMY_API_URL_GOERLI

export const getLatestBlockNumber = (url: string): Promise<string> => {
  const payload = {
    jsonrpc: '2.0',
    method: 'eth_blockNumber',
    params: [],
    id: 0,
  }
  const headers = {
    'Content-Type': 'application/json',
  }

  // Latest block number in hex format.
  return axios.post(url, payload, { headers }).then(res => res.data.result)
}

export const getCode = async (url: string, contractAddress: string, blockNumber: string): Promise<string> => {
  const payload = {
    jsonrpc: '2.0',
    method: 'eth_getCode',
    params: [contractAddress, blockNumber],
    id: 0,
  }
  const headers = {
    'Content-Type': 'application/json',
  }

  const result = await axios.post(url, payload, { headers }).then(res => res.data.result)

  return result
}

const binarySearch = async (url: string, start: number, end: number, contractAddress: string): Promise<number> => {
  if (start > end) {
    return -1
  }

  if (start === end) {
    return start
  }

  const mid = Math.floor((start + end) / 2)

  const code = await getCode(url, contractAddress, '0x' + mid.toString(16))
  if (code !== '0x') {
    return binarySearch(url, start, mid, contractAddress)
  } else if (code === '0x') {
    return binarySearch(url, mid + 1, end, contractAddress)
  }
}

const getTxReceipts = async (url: string, blockNumber: number): Promise<any[]> => {
  try {
    const payload = {
      jsonrpc: '2.0',
      method: 'alchemy_getTransactionReceipts',
      params: [{ blockNumber: '0x' + blockNumber.toString(16) }],
      id: 1,
    }
    const headers = {
      'Content-Type': 'application/json',
    }
    const res = await axios.post(url, payload, { headers })
    if (res && res.data.result) {
      const result = res.data.result
      return result?.['receipts']
    } else {
      logger.error({ err: res.data.error, res })
      return []
    }
  } catch (err) {
    logger.error('error in getTxReceipts err: ', err)
    return []
  }
}

const secondaryCollectionDeployerHelper = async (contractAddress: string, chainId: string): Promise<string | null> => {
  const apiKeys = [
    '1DRNAZ39TR2VSYXS9BCYMS48GIIMMC4WXP',
    'NBD9XB7AEMGKGV2HHXR22915ABNRHU21SU',
    'XHSKP3E7E312CY67D7KSJDB8ZMPGTKKGUM',
  ]
  const network = chainId === '1' ? 'api' : 'api-goerli'
  const apiKey = apiKeys[Math.floor(Math.random() * apiKeys.length)]
  const url = `https://${network}.etherscan.io/api?module=contract&action=getcontractcreation&contractaddresses=${contractAddress}&apikey=${apiKey}`

  const response = await axios.get(url)
  const data = response.data

  if (data.status === '0') {
    throw new Error(data.result)
  }

  const result = data.result[0]
  if (!result) {
    throw new Error('Contract source code not found')
  }

  const deployerAddress = result.contractCreator
  if (!deployerAddress) {
    throw new Error('Deployer address not found in contract source code')
  }

  return deployerAddress
}

export const getCollectionDeployer = async (contractAddress: string, chainId: string): Promise<string | null> => {
  try {
    const cacheKey = `DEPLOYER_ADDRESS_${contractAddress}_${chainId}`
    const cached = await cache.get(cacheKey)
    if (cached) {
      return cached
    } else {
      chainId = chainId ?? process.env.CHAIN_ID
      const REQUEST_URL = chainId === '1' ? ALCHEMY_API_URL : ALCHEMY_API_URL_GOERLI
      const lastBlock = await getLatestBlockNumber(REQUEST_URL)

      const deployedBlockNumber = await binarySearch(
        REQUEST_URL,
        0, // start
        parseInt(lastBlock, 16) - 1, // end
        contractAddress,
      )

      const receipts = await getTxReceipts(REQUEST_URL, deployedBlockNumber)

      const collectionDeployer =
        receipts?.find(receipt => receipt?.contractAddress === contractAddress.toLowerCase())?.from ??
        (await secondaryCollectionDeployerHelper(contractAddress, chainId))

      try {
        const checksummed = ethers.utils.getAddress(collectionDeployer)
        await cache.set(cacheKey, checksummed)
        return checksummed
      } catch {
        Sentry.captureMessage('Error in getCollectionDeployer: invalid checksum', collectionDeployer)
        return null
      }
    }
  } catch (err) {
    logger.error('error in getCollectionDeployer: ', err)
  }
}
