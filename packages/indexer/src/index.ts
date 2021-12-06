import axios from 'axios'
import { ethers } from 'ethers'
import kill from 'kill-port'
import cron from 'node-cron'

// import AbiCoder from 'web3-eth-abi/src'
// import { defs } from '@nftcom/shared'
import { db, fp } from '@nftcom/shared'

import { dbConfig, infuraProvider, provider, serverPort, verifyConfiguration } from './config'
import * as server from './server'

const repositories = db.newRepositories()
const etherscanError = ['Contract source code not verified', 'Max rate limit reached', 'Invalid API Key']
const erc721Bytes = [
  '0x80ac58cd', // 721
  '0x780e9d63', // 721_enum
  '0x5b5e139f', // 721_meta
]
const erc1155Bytes = ['0xd9b67a26']
// // keccak256('TransferSingle(address,address,address,uint256,uint256)')
// const TransferSingleHash = '0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62'
// const TransferSingleInput = '[{"indexed":true,"internalType":"address","name":"_operator","type":"address"},{"indexed":true,"internalType":"address","name":"_from","type":"address"},{"indexed":true,"internalType":"address","name":"_to","type":"address"},{"indexed":false,"internalType":"uint256","name":"_id","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"_value","type":"uint256"}]'
// // keccak256('TransferBatch(address,address,address,uint256[],uint256[])')
// const TransferBatchHash = '0x4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb'
// const TransferBatchInput = '[{"indexed":true,"internalType":"address","name":"_operator","type":"address"},{"indexed":true,"internalType":"address","name":"_from","type":"address"},{"indexed":true,"internalType":"address","name":"_to","type":"address"},{"indexed":false,"internalType":"uint256[]","name":"_ids","type":"uint256[]"},{"indexed":false,"internalType":"uint256[]","name":"_values","type":"uint256[]"}]'
// const erc1155topic0 = [TransferSingleHash, TransferBatchHash]
// const erc1155inputs = [TransferSingleInput, TransferBatchInput]

// const get1155Input = (hash: string): string => {
//   switch (hash) {
//   case erc1155topic0[0]:
//     return erc1155inputs[0]
//   case erc1155topic0[1]:
//     return erc1155inputs[1]
//   default:
//     throw new Error('Invalid')
//   }
// }

// const parse = (log: any, abi: any): defs.ParsedEthLog => {
//   const validNames = ['Transfer', 'TransferBatch', 'TransferSingle']
//   const events = abi.filter(e => e.type === 'event' && validNames.includes(e.name) && e.anonymous === false)

//   const signature = log.topics[0]
//   const event = events.find(e => AbiCoder.encodeEventSignature(e) === signature)

//   if (event) {
//     const rawReturnValues = AbiCoder.decodeLog(event.inputs, log.data, log.topics.slice(1))
//     const returnValues = Object.keys(rawReturnValues)
//       .filter((key: any) => isNaN(key) && key !== '__length__')
//       .reduce((obj, key) => ({ ...obj, [key]: rawReturnValues[key] }), {})

//     return {
//       event: event.name,
//       signature: signature,
//       address: log.address,
//       blockHash: log.blockHash,
//       blockNumber: log.blockNumber,
//       transactionHash: log.transactionHash,
//       transactionIndex: log.transactionIndex,
//       logIndex: log.logIndex,
//       raw: {
//         data: log.data,
//         topics: log.topics,
//       },
//       returnValues: returnValues,
//     }
//   } else {
//     // if not found, try 1155s (if not verified)
//     const event1155 = erc1155topic0.find(e => e === signature)
//     if (event1155) {
//       const rawReturnValues = AbiCoder.decodeLog(
//         JSON.parse(get1155Input(event1155)), log.data, log.topics.slice(1))
//       const returnValues = Object.keys(rawReturnValues)
//         .filter((key: any) => isNaN(key) && key !== '__length__')
//         .reduce((obj, key) => ({ ...obj, [key]: rawReturnValues[key] }), {})

//       return {
//         event: event.name,
//         signature: signature,
//         address: log.address,
//         blockHash: log.blockHash,
//         blockNumber: log.blockNumber,
//         transactionHash: log.transactionHash,
//         transactionIndex: log.transactionIndex,
//         logIndex: log.logIndex,
//         raw: {
//           data: log.data,
//           topics: log.topics,
//         },
//         returnValues: returnValues,
//       }
//     } else {
//       console.log('Cannot parse unknown event')
//     }
//   }
// }

const supportsInterfaceABI = `[{
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

const is1155 = async (address: string): Promise<boolean> => {
  try {
    const contract = new ethers.Contract(
      address,
      supportsInterfaceABI,
      new ethers.providers.InfuraProvider(
        'homestead',
        infuraProvider(),
      ),
    )

    // makes sure no revert
    await contract.estimateGas.supportsInterface(erc1155Bytes[0])

    return await contract.supportsInterface(erc1155Bytes[0])
  } catch (err) {
    return false
  }
}

const is721 = async (address: string): Promise<boolean> => {
  try {
    // valid ERC721 and ERC1155 event names
    const contract = new ethers.Contract(
      address,
      supportsInterfaceABI,
      new ethers.providers.InfuraProvider(
        'homestead',
        infuraProvider(),
      ),
    )

    // makes sure no revert
    await contract.estimateGas.supportsInterface(erc721Bytes[0])

    return await contract.supportsInterface(erc721Bytes[0]) ||
            await contract.supportsInterface(erc721Bytes[1]) ||
            await contract.supportsInterface(erc721Bytes[2])
  } catch (err) {
    return false
  }
}

const getImplementationDetails = async(): Promise<void> => {
  try {
    console.log('@implementation')
    const nullContracts = await repositories.contractInfo.find({
      where: {
        abi: null,
      },
    })

    for (let i = 0; i < nullContracts.length; i++) {
      const proxyResult = await axios.get(`https://api.etherscan.io/api?module=contract&action=getsourcecode&address=${nullContracts[i].contract}&apikey=${provider()}`)
          
      if (etherscanError.includes(proxyResult.data.result)) {
        console.log(etherscanError[etherscanError.indexOf(proxyResult.data.result)] + ' ' + nullContracts[i].contract)
        if (proxyResult.data.result === 'Contract source code not verified') {
          await repositories.contractInfo.update(
            {
              id: nullContracts[i].id,
            },
            {
              abi: 'Contract source code not verified',
            },
          )
        }
      } else {
        const implementation = proxyResult.data.result[0].Implementation
        if (!implementation) {
          const abiResult = await axios.get(`https://api.etherscan.io/api?module=contract&action=getabi&address=${nullContracts[i].contract}&apikey=${provider()}`)

          if (etherscanError.includes(abiResult.data.result)) {
            console.log(etherscanError[etherscanError.indexOf(abiResult.data.result)] + ' ' + nullContracts[i].contract)
            if (abiResult.data.result === 'Contract source code not verified') {
              await repositories.contractInfo.update(
                {
                  id: nullContracts[i].id,
                },
                {
                  abi: 'Contract source code not verified',
                },
              )
            }
          } else {
            await repositories.contractInfo.update(
              {
                id: nullContracts[i].id,
              },
              {
                abi: abiResult.data.result,
                proxy: false,
                contractName: proxyResult.data.result[0].ContractName,
              },
            )
            console.log(`^ updated ${nullContracts[i].contract} with abi`)
          }
        } else {
          const abiResult = await axios.get(`https://api.etherscan.io/api?module=contract&action=getabi&address=${nullContracts[i].contract}&apikey=${provider()}`)
          const abiResultImp = await axios.get(`https://api.etherscan.io/api?module=contract&action=getabi&address=${implementation}&apikey=${provider()}`)

          if (etherscanError.includes(abiResult.data.result)) {
            console.log(etherscanError[etherscanError.indexOf(abiResult.data.result)] + ' ' + nullContracts[i].contract)
            if (abiResult.data.result === 'Contract source code not verified') {
              await repositories.contractInfo.update(
                {
                  id: nullContracts[i].id,
                },
                {
                  abi: 'Contract source code not verified',
                },
              )
            }
          } else if (etherscanError.includes(abiResultImp.data.result)) {
            console.log('imp error: ' + etherscanError[etherscanError.indexOf(abiResultImp.data.result)] + ' ' + implementation)
            if (abiResultImp.data.result === 'Contract source code not verified') {
              await repositories.contractInfo.update(
                {
                  id: nullContracts[i].id,
                },
                {
                  implementationAbi: 'Contract source code not verified',
                },
              )
            }
          } else {
            await repositories.contractInfo.update(
              {
                id: nullContracts[i].id,
              },
              {
                abi: abiResult.data.result,
                proxy: true,
                implementation: implementation,
                implementationAbi: abiResultImp.data.result,
                contractName: proxyResult.data.result[0].ContractName,
                implementationName: abiResultImp.data.result[0].ContractName,
              },
            )
            console.log(`^ updated ${nullContracts[i].contract} with proxy/imp abi`)
          }
        }
      }
    }
  } catch (err) {
    console.log('error while pulling etherscan: ', err)
  }
}

const getNftLogs = async (fromBlock = 'latest', toBlock = 'latest'): Promise<void> => {
  const result = await axios.post(
    `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_API}`,
    {
      jsonrpc: '2.0',
      method: 'eth_getLogs',
      params: [{
        fromBlock,
        toBlock,
      }],
      id: 0,
    },
  )

  const nftArray = []
  const filteredResults: string[] = result.data.result
    .filter(data => data.topics.length > 0)
    .map(item => item.address)

  const rawArray: string[] = [...new Set(filteredResults)]

  console.log('filtered: ', rawArray.length)

  for (let i = 0; i < rawArray.length; i++) {
    const foundInfo = await repositories.contractInfo.findOne({
      where: {
        contract: rawArray[i],
      },
    })

    if (!foundInfo) {
      const bool721 = await is721(rawArray[i])
      const bool1155 = await is1155(rawArray[i])
      if (bool721 && bool1155) {
        nftArray.push({
          address: rawArray[i],
          bool721: true,
          bool1155: true,
        })
        console.log(`====> ${i + 1}/${rawArray.length}: ${rawArray[i]}`)
      } else if (bool721) {
        nftArray.push({
          address: rawArray[i],
          bool721: true,
          bool1155: false,
        })
        console.log(`====> ${i + 1}/${rawArray.length}: ${rawArray[i]}`)
      } else if (bool1155) {
        nftArray.push({
          address: rawArray[i],
          bool721: false,
          bool1155: true,
        })
        console.log(`====> ${i + 1}/${rawArray.length}: ${rawArray[i]}`)
      } else {
        // neither => maybe non-standard NFT
        // TODO run extra tests perhaps
      }
    }
  }

  nftArray.map(async data => {
    await repositories.contractInfo.save({
      network: 'Ethereum',
      contract: data.address,
      bool721: data.bool721,
      bool1155: data.bool1155,
    })
    console.log(`*** SAVED *** ${data.address}, 721=${data.bool721}, 1155=${data.bool1155}`)
  })

  console.log(`${nftArray.length} new NFTs found`)
}

const startCron = (): Promise<void> => {
  // 30 seconds
  cron.schedule(
    '*/30 * * * * *',
    () => {
      getNftLogs()
    },
    {
      scheduled: true,
      timezone: 'America/Chicago',
    },
  )

  // 3 minutes
  cron.schedule(
    '0 */3 * * * *',
    () => {
      getImplementationDetails()
    },
    {
      scheduled: true,
      timezone: 'America/Chicago',
    },
  )

  return
}

const bootstrap = (): Promise<void> => {
  verifyConfiguration()
  return db.connect(dbConfig)
    .then(() => server.start())
    .then(startCron)
    .then(fp.pause(500))
}

const handleError = (err: Error): void => {
  console.error(err)
  throw err
}

const killPort = (): Promise<unknown> => {
  return kill(serverPort)
    // Without this small delay sometimes it's not killed in time
    .then(fp.pause(500))
    .catch((err: any) => console.log(err))
}

const logGoodbye = (): void => {
  console.log('Cya! Thanks for stopping by.')
}

const cleanExit = (): Promise<void> => {
  return server.stop()
    .then(killPort)
    .then(db.disconnect)
    // .then(job.stopAndDisconnect)
    .then(fp.pause(500))
    .finally(() => {
      logGoodbye()
      process.exit()
    })
}

process.on('SIGINT', cleanExit)
process.on('SIGTERM', cleanExit)

bootstrap().catch(handleError)
