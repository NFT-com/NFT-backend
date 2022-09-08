import {
  getCode,
  getCollectionDeployer,
  getLatestBlockNumber,
} from '@nftcom/gql/service/alchemy.service'
import { nftProfileAddress } from '@nftcom/shared/helper/contracts'

jest.setTimeout(50000)
jest.retryTimes(2)

jest.mock('@nftcom/gql/service/cache.service', () => ({
  cache: jest.fn(),
  createCacheConnection: jest.fn(),
}))

const REQUEST_URL = process.env.ALCHEMY_API_URL

describe('alchemy service functions', () => {
  it('should get the latest block', async () => {
    const block = await getLatestBlockNumber(REQUEST_URL)
    expect(block).not.toBeNull()
    expect(parseInt(block, 16)).toBeGreaterThan(0)
  })

  it('should get a correct code', async () => {
    const contract = nftProfileAddress()
    // this is the actual deployment block
    const block = 14681511
    const code = await getCode(REQUEST_URL, contract, '0x' + block.toString(16))
    expect(code).toBe('0x60806040523661001357610011610017565b005b6100115b61002761002261005e565b610096565b565b606061004e838360405180606001604052806027815260200161024c602791396100ba565b9392505050565b3b151590565b90565b60006100917f360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc546001600160a01b031690565b905090565b3660008037600080366000845af43d6000803e8080156100b5573d6000f35b3d6000fd5b6060833b61011e5760405162461bcd60e51b815260206004820152602660248201527f416464726573733a2064656c65676174652063616c6c20746f206e6f6e2d636f6044820152651b9d1c9858dd60d21b60648201526084015b60405180910390fd5b600080856001600160a01b03168560405161013991906101cc565b600060405180830381855af49150503d8060008114610174576040519150601f19603f3d011682016040523d82523d6000602084013e610179565b606091505b5091509150610189828286610193565b9695505050505050565b606083156101a257508161004e565b8251156101b25782518084602001fd5b8160405162461bcd60e51b815260040161011591906101e8565b600082516101de81846020870161021b565b9190910192915050565b600060208252825180602084015261020781604085016020870161021b565b601f01601f19169190910160400192915050565b60005b8381101561023657818101518382015260200161021e565b83811115610245576000848401525b5050505056fe416464726573733a206c6f772d6c6576656c2064656c65676174652063616c6c206661696c6564a26469706673582212209b8470f06e8a3960c912103fc2be177edaad69584ee3c7d2809ee737e79408e764736f6c63430008020033')
  })

  it.skip('should get the correct mainnet deployer', async () => {
    const deployer = await getCollectionDeployer(nftProfileAddress(), '1')
    expect(deployer).toBe('0x487F09bD7554e66f131e24edC1EfEe0e0Dfa7fD1')
  })
})
