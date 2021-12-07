import axios from 'axios'
import base64 from 'base-64'
import chalk from 'chalk'
import { ethers } from 'ethers'
import { defaultAbiCoder } from 'ethers/lib/utils'
import isBase64 from 'is-base64'
import isIPFS from 'is-ipfs'
import isUrl from 'is-url'
import kill from 'kill-port'
import cron from 'node-cron'

// import Web3 from'web3'
// import AbiCoder from 'web3-eth-abi/src'
import { defs } from '@nftcom/shared'
import { db, fp } from '@nftcom/shared'

import { dbConfig, infuraProvider, MAX_LOOPS, provider, serverPort, verifyConfiguration } from './config'
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

const nftInterface = `[{
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

const getTokenUri = async(
  network: string,
  tokenId: number,
  contractAddress: string,
): Promise<string> => {
  const contract = new ethers.Contract(
    contractAddress,
    nftInterface,
    new ethers.providers.InfuraProvider(
      'homestead',
      infuraProvider(),
    ),
  )
  
  try {
    return await contract.tokenURI(tokenId)
  } catch (err) {
    try {
      const result = await contract.tokenInfo(tokenId)
      return result.tokenUri
    } catch (err2) {
      console.log(chalk.red(`revert getting token uri (${err2.code}): ${contract.address}, tokenId=${tokenId}`))

      await repositories.nftRaw.save({
        network: network,
        contract: contract.address,
        tokenId: tokenId,
        type: defs.NFTType.ERC721,
        error: true,
        errorReason: err.code ?? err2.code,
        metadataURL: null,
        metadata: null,
      })
      return undefined
    }
  }
}

const getMetaData = async(tokenUri: string): Promise<any> => {
  try {
    if (isBase64(tokenUri)) {
      console.log(chalk.green('^base64'))
      return base64.decode(tokenUri)
    } else if (isIPFS.multihash(tokenUri)) {
      console.log(chalk.green('^multihash', tokenUri))
      const result = await axios.get(`https://cloudflare-ipfs.com/ipfs/${tokenUri}`)
      return result.data
    } else if (isIPFS.url(tokenUri)) {
      console.log(chalk.green('^url', tokenUri))
      const result = await axios.get(`${tokenUri}`)
      return result.data
    } else if (isIPFS.ipfsUrl(tokenUri)) {
      console.log(chalk.green('^ipfs url', tokenUri))
      const result = await axios.get(`${tokenUri}`)
      return result.data
    } else if (tokenUri.indexOf('ipfs://') != -1) {
      console.log(chalk.green('^ipfs resource', tokenUri))
      const result = await axios.get(`https://cloudflare-ipfs.com/${tokenUri.replace('ipfs://', 'ipfs/')}`)
      return result.data
    } else if (isUrl(tokenUri)) {
      console.log(chalk.green('^regular url: ', tokenUri))
      const result = await axios.get(tokenUri)
      return result.data
    } else {
      if (tokenUri.indexOf('data:application/json;base64,') != -1) {
        const base64Parse = tokenUri.replace('data:application/json;base64,', '')

        if (isBase64(base64Parse)) {
          console.log(chalk.green('^base64'))
          return base64.decode(base64Parse)
        } else {
          console.log(chalk.yellow(`^metadata non-conforming: ${tokenUri}`))
          return undefined
        }
      } else {
        console.log(chalk.yellow(`^metadata non-conforming: ${tokenUri}`))
        return undefined
      }
    }
  } catch (err) {
    console.log('^error while getting metadata: ', err)
    return undefined
  }
}

const encodedTransferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

// const getTimestampFromBlock = async (block: number): Promise<number> => {
//   const web3 = new Web3(new Web3.providers.HttpProvider(`https://mainnet.infura.io/v3/${infuraProvider()}`))
//   const result = await web3.eth.getBlock(block)
//   return Number(result.timestamp) * 1000 // for milliseconds
// }

// TODO looping through tokenIds from 0 -> totalSupply is bad since some tokenIds don't have metadata yet
// TODO better way is to filter tokenIds by mint (0x0 tx => address)
const populateTokenIds = async(): Promise<void> => {
  try {
    console.log('@populating token ids')
    const ethContracts = await repositories.contractInfo.find({
      where: {
        network: 'Ethereum',
        bool721: true,
      },
    })

    // TODO maybe just get all the addresses in contractInfo
    // and add to all the repos and save all at once

    for (let i = 0; i < ethContracts.length; i++) {
      const combinedFilter = {
        address: ethContracts[i].contract,
        topics: [
          [encodedTransferTopic],
        ],
        fromBlock: 0, // TODO optimize call later by remember which blocks we've seen?
      }
      
      try {
        const result = await new ethers.providers.InfuraProvider(
          'homestead',
          infuraProvider(),
        ).getLogs(combinedFilter)

        console.log(chalk.green(`====> filtered logs ${ethContracts[i].contract}`))

        // make sure tokenId hasn't been seen before
        const allNftRaw = await repositories.nftRaw.find({
          where: {
            contract: ethContracts[i].contract,
          },
        })

        const allNftTrade = await repositories.nftTrade.find({
          where: {
            contract: ethContracts[i].contract,
          },
        })

        const tokenIds: string[] = [...new Set(allNftRaw.map(i => i.tokenId.toString()))]
        const nftTrades: string[] = [...new Set(allNftTrade.map(i => i.transactionHash))]

        // seenMap is a birds eye view of every unique tokenId and transferHash given a contract address at the time of call
        const seenMap = tokenIds.concat(nftTrades).reduce(function(map, obj) {
          map[obj] = true
          return map
        }, {})

        const bulkSaveNftRaw = []
        const bulkSaveNftTrade = []

        for (let j = 0; j < result.length; j++) {
          const topics = result[j].topics

          const from = defaultAbiCoder.decode(['address'] , topics[1]).toString()
          const to = defaultAbiCoder.decode(['address'] , topics[2]).toString()
          const tokenId = Number(defaultAbiCoder.decode(['uint256'] , topics[3]).toString())

          if (!seenMap[tokenId.toString()]) {
            bulkSaveNftRaw.push({
              network: ethContracts[i].network,
              contract: ethContracts[i].contract,
              tokenId: tokenId,
              type: defs.NFTType.ERC721,
            })
            
            seenMap[tokenId.toString()] = true
          }

          if (!seenMap[result[j].transactionHash]) {
            // TODO add to cron timestamp => const timestamp = await getTimestampFromBlock(Number(result[j].blockNumber))
            // save quickly for later cron job (to update metadata)
            bulkSaveNftTrade.push({
              network: ethContracts[i].network,
              contract: ethContracts[i].contract,
              transactionHash: result[j].transactionHash,
              from: from,
              to: to,
              tokenId: tokenId,
              blockNumber: Number(result[j].blockNumber),
            })

            seenMap[result[j].transactionHash] = true
          }
        }

        if (bulkSaveNftTrade.length > 0) {
          await repositories.nftTrade.saveMany(
            bulkSaveNftTrade,
          )

          console.log(chalk.cyan(`*** SAVED *** ${bulkSaveNftTrade.length} nftTrade`))
        } else {
          console.log(chalk.cyan('no new nftTrades'))
        }

        if (bulkSaveNftRaw.length > 0) {
          await repositories.nftRaw.saveMany(
            bulkSaveNftRaw,
          )
    
          console.log(chalk.cyan(`*** SAVED *** ${bulkSaveNftRaw.length} nftRaws`))
        } else {
          console.log(chalk.cyan('no new nftRaws'))
        }
      } catch (errLogs) {
        console.log('errLog: ', errLogs.body)
      }
    }
  } catch (err) {
    console.log('populateTokenIds err: ', err.body)
  }
}

const importMetaData = async(): Promise<void> => {
  try {
    const nullTokens = await repositories.nftRaw.find({
      where: {
        metadataURL: null,
      },
    })

    let loop = 0
    for (let i = 0; i < nullTokens.length && loop < MAX_LOOPS; i++) {
      const tokenUri = await getTokenUri(
        nullTokens[i].network,
        Number(nullTokens[i].tokenId),
        nullTokens[i].contract,
      )

      if (tokenUri) {
        const jsonMetaData = await getMetaData(tokenUri)
  
        if (jsonMetaData) {
          await repositories.nftRaw.save({
            network: nullTokens[i].network,
            contract: nullTokens[i].contract,
            tokenId: nullTokens[i].tokenId,
            type: defs.NFTType.ERC721,
            metadataURL: tokenUri,
            metadata: jsonMetaData,
          })
  
          console.log(
            chalk.yellow(
              `*** SAVED *** RawNft: ${nullTokens[i].contract}, tokenId=${nullTokens[i].tokenId}, tokenUri=${(isBase64(tokenUri) || tokenUri.indexOf('data:application/json;base64,') != -1) ? 'base64' : tokenUri}`,
            ),
          )
        }
      }

      loop += 1
    }
  } catch (err) {
    console.log('error importing metadata: ', err)
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

    let loop = 0
    for (let i = 0; i < nullContracts.length && loop < MAX_LOOPS; i++) {
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

      loop += 1
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
          network: 'Ethereum',
          contract: rawArray[i],
          bool721: true,
          bool1155: true,
        })
        console.log(`====> ${i + 1}/${rawArray.length}: ${rawArray[i]}`)
      } else if (bool721) {
        nftArray.push({
          network: 'Ethereum',
          contract: rawArray[i],
          bool721: true,
          bool1155: false,
        })
        console.log(`====> ${i + 1}/${rawArray.length}: ${rawArray[i]}`)
      } else if (bool1155) {
        nftArray.push({
          network: 'Ethereum',
          contract: rawArray[i],
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

  await repositories.contractInfo.saveMany(nftArray)
  console.log(chalk.green(`*** SAVED ${nftArray.length} New NFTs ***`))
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
      importMetaData()
    },
    {
      scheduled: true,
      timezone: 'America/Chicago',
    },
  )

  cron.schedule(
    '0 */2 * * * *',
    () => {
      populateTokenIds()
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
