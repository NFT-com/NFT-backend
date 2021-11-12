import { JsonRpcProvider } from '@ethersproject/providers'
import { blockchainConfig } from '@src/config'

const providers: { [key: string]: JsonRpcProvider } = {}
export const createProviders = (): void => {
  blockchainConfig.networksURI.forEach((val: string, key: string) => {
    providers[key] = new JsonRpcProvider(val)
  })
}

// export const getSigner = (chainId: string): Signer => {
//   const provider = providers[chainId]
//   return new Wallet(blockchainConfig.contractAccountPK, provider)
// }
//
// export const getContract = (chainId: string): Contract => {
//   const signer = getSigner(chainId)
//   const contractAddress = blockchainConfig.contractIds.get(chainId)
//   return new Contract(contractAddress, 'contractABI', signer)
// }

// export const getABIInterface = (): Interface => {
//   return new Interface('contractABI')
// }
//
// export const toGasUnits = (val: string): BigNumber => {
//   return parseUnits(val, 'gwei')
// }

// type ContractOptions = {
//   gasLimit: BigNumber
//   gasPrice: BigNumber
// }

// export const getGasConf = (
//   gasLimit = '0.01',
//   gasPrice = '20.0',
// ): ContractOptions => ({
//   gasLimit: toGasUnits(gasLimit),
//   gasPrice: toGasUnits(gasPrice),
// })
