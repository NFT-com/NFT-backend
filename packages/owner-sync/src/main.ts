import { BigNumber } from 'ethers'
import { AbiCoder } from 'ethers/lib/utils'
import Web3 from 'web3'
import { AbiItem } from 'web3-utils'

// We assign a default web3 provider
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

const getOwnersForContract = async (nftAbi: AbiItem[], nftAddress: string, multicallContract): Promise<void> => {
  const nftContract = new web3.eth.Contract(nftAbi, nftAddress)

  const multicallArgs = ['0x02cd', '0x0e36', '0x0545'].map((tokenIdHex) => {
    const callData = nftContract.methods['ownerOf'](BigNumber.from(tokenIdHex).toBigInt()).encodeABI()
    return {
      target: nftAddress,
      callData: callData,
    }
  })
  // call multicall. The multicallArgs will call the NFT contract
  // and return the ownersOf token id 1,2,3
  try {
    const ownersOf = await multicallContract.methods['aggregate'](
      multicallArgs,
    ).call()
    const abiCoder = new AbiCoder()
    for (const data of ownersOf.returnData as string) {
      console.log(abiCoder.decode(['address'], data)[0])
    }
  } catch (err) {
    // If current provider is not available, try another one from the list
    const res = JSON.stringify(err, Object.getOwnPropertyNames(err))
    if (res.includes('Invalid JSON RPC response'))
      (await providerSelector()) ? getOwnersForContract(nftAbi, nftAddress, multicallContract) : console.log('No providers available')
    console.log(err)
  }
}

const main = async (): Promise<void> => {
  // address of ERC721 NFT
  const nftAddress = '0xfb9e9e7150cCebFe42D58de1989C5283d0EAAB2e'
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

  await getOwnersForContract(nftAbi, nftAddress, multicallContract)
}

main()