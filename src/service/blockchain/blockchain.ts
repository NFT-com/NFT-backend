import { ethers,utils } from 'ethers'

import { blockchainConfig } from '@src/config'

const providers: { [key: string]: ethers.providers.JsonRpcProvider } = {}
export const createProviders = (): void => {
  blockchainConfig.networksURI.forEach((val: string, key: string) => {
    providers[key] = new ethers.providers.JsonRpcProvider(val)
  })
}

export const getSigner = (chainId: string): ethers.Signer => {
  const provider = providers[chainId]
  return new ethers.Wallet(blockchainConfig.contractAccountPK, provider)
}

export const getContract = (chainId: string): ethers.Contract => {
  const signer = getSigner(chainId)
  const contractAddress = blockchainConfig.contractIds.get(chainId)
  return new ethers.Contract(contractAddress, 'contractABI', signer)
}

export const getABIInterface = (): utils.Interface => {
  return new utils.Interface('contractABI')
}

export const toGasUnits = (val: string): ethers.BigNumber => {
  return utils.parseUnits(val, 'gwei')
}

type ContractOptions = {
  gasLimit: ethers.BigNumber
  gasPrice: ethers.BigNumber
}

export const getGasConf = (
  gasLimit = '0.01',
  gasPrice = '20.0',
): ContractOptions => ({
  gasLimit: toGasUnits(gasLimit),
  gasPrice: toGasUnits(gasPrice),
})
