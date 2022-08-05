import axios from 'axios'
import { ethers } from 'ethers'

import * as Sentry from '@sentry/node'

const ALCHEMY_API_URL = process.env.ALCHEMY_API_URL
const ALCHEMY_API_URL_RINKEBY = process.env.ALCHEMY_API_URL_RINKEBY
const ALCHEMY_API_URL_GOERLI = process.env.ALCHEMY_API_URL_GOERLI

export const getLatestBlockNumber = (url: string): Promise<string> => {
  const payload = {
    'jsonrpc': '2.0',
    'method': 'eth_blockNumber',
    'params': [],
    'id': 0,
  }
  const headers = {
    'Content-Type': 'application/json',
  }

  // Latest block number in hex format.
  return axios.post(url, payload, { headers }).then(res => res.data.result)
}

export const getCode = async (
  url: string,
  contractAddress: string,
  blockNumber: string,
): Promise<string> => {
  const payload = {
    'jsonrpc': '2.0',
    'method': 'eth_getCode',
    'params': [contractAddress, blockNumber],
    'id': 0,
  }
  const headers = {
    'Content-Type': 'application/json',
  }
    
  const result = await axios.post(url, payload, { headers }).then(res => res.data.result)
  
  return result
}

const binarySearch = async (
  url: string,
  start: number,
  end: number,
  contractAddress: string,
): Promise<number> => {
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

const getTxReceipts = async (
  url: string,
  blockNumber: number,
): Promise<any[]> => {
  const payload = {
    'jsonrpc': '2.0',
    'method': 'alchemy_getTransactionReceipts',
    'params': [{ blockNumber: '0x' + blockNumber.toString(16) }],
    'id': 1,
  }
  const headers = {
    'Content-Type': 'application/json',
  }
  const result = await axios.post(url, payload, { headers }).then(res => res.data.result)
  return result?.['receipts']
}

export const getCollectionDeployer = async (
  contractAddress: string,
  chainId: string,
): Promise<string | null> => {
  try {
    chainId = chainId ?? process.env.CHAIN_ID
    const REQUEST_URL = chainId === '1' ? ALCHEMY_API_URL :
      (chainId === '5' ? ALCHEMY_API_URL_GOERLI : ALCHEMY_API_URL_RINKEBY)
    const lastBlock = await getLatestBlockNumber(REQUEST_URL)
    
    const deployedBlockNumber = await binarySearch(
      REQUEST_URL,
      0, // start
      parseInt(lastBlock, 16) - 1, // end
      contractAddress,
    )
    
    const receipts = await getTxReceipts(REQUEST_URL, deployedBlockNumber)
    const collectionDeployer = receipts?.find(
      receipt => receipt?.contractAddress === contractAddress.toLowerCase(),
    )?.from
    try {
      const checksummed = ethers.utils.getAddress(collectionDeployer)
      return checksummed
    } catch {
      Sentry.captureMessage('Error in getCollectionDeployer: invalid checksum', collectionDeployer)
      return null
    }
  } catch (err) {
    console.log('error in getCollectionDeployer: ', err)
  }
}