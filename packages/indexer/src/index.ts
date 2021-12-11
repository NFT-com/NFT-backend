import axios from 'axios'
import base64 from 'base-64'
import chalk from 'chalk'
import delay from 'delay'
import { ethers } from 'ethers'
import { defaultAbiCoder } from 'ethers/lib/utils'
import isBase64 from 'is-base64'
import isIPFS from 'is-ipfs'
import isUrl from 'is-url'
import kill from 'kill-port'
import { IsNull, Not } from 'typeorm'

import { defs } from '@nftcom/shared'
import { db, fp } from '@nftcom/shared'

import { dbConfig, erc721Bytes, erc1155Bytes, etherscanError,infuraProvider, MAX_LOOPS, nftInterface, provider, serverPort, supportsInterfaceABI, verifyConfiguration } from './config'
import * as server from './server'

const repositories = db.newRepositories()

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

    return await contract.supportsInterface(erc721Bytes[0]) ||
            await contract.supportsInterface(erc721Bytes[1]) ||
            await contract.supportsInterface(erc721Bytes[2])
  } catch (err) {
    return false
  }
}

const getTokenUri = async(
  tokenId: number,
  contractAddress: string,
  existingId: string,
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
    const uri = await contract.tokenURI(tokenId)

    if (uri.length > 0) {
      return uri
    } else {
      await repositories.nftRaw.update(
        {
          id: existingId,
        },
        {
          error: true,
          errorReason: 'uri is length 0',
          metadataURL: null,
          metadata: null,
        },
      )
    }
  } catch (err) {
    console.log(chalk.red(`revert getting token id (${err.code}): ${contract.address}, tokenId=${tokenId}`))
    try {
      const result = await contract.tokenInfo(tokenId)
      return result.tokenUri
    } catch (err2) {
      console.log(chalk.red(`revert getting token info (${err2.code}): ${contract.address}, tokenId=${tokenId}`))

      await repositories.nftRaw.update(
        {
          id: existingId,
        },
        {
          error: true,
          errorReason: err.code ?? err2.code,
          metadataURL: null,
          metadata: null,
        },
      )

      return undefined
    }
  }
}

const getMetaData = async(id: string, contract: string, tokenUri: string): Promise<any> => {
  try {
    if (isBase64(tokenUri)) {
      console.log(chalk.green('^base64'))
      return { id, contract, metadata: base64.decode(tokenUri) }
    } else if (isIPFS.multihash(tokenUri)) {
      console.log(chalk.green('^multihash', tokenUri))
      const result = await axios.get(`https://nft-llc.mypinata.cloud/ipfs/${tokenUri}`)
      return { id, contract, metadata: result.data }
    } else if (isIPFS.url(tokenUri)) {
      console.log(chalk.green('^url', tokenUri))
      const result = await axios.get(`${tokenUri.replace('gateway.pinata.cloud', 'nft-llc.mypinata.cloud')}`)
      return { id, contract, metadata: result.data }
    } else if (isIPFS.ipfsUrl(tokenUri)) {
      console.log(chalk.green('^ipfs url', tokenUri))
      const result = await axios.get(`${tokenUri.replace('gateway.pinata.cloud', 'nft-llc.mypinata.cloud')}`)
      return { id, contract, metadata: result.data }
    } else if (tokenUri.indexOf('ipfs://') != -1) {
      console.log(chalk.green('^ipfs resource', tokenUri))
      const result = await axios.get(`https://nft-llc.mypinata.cloud/${tokenUri.replace('ipfs://', 'ipfs/')}`)
      return { id, contract, metadata: result.data }
    } else if (isUrl(tokenUri)) {
      console.log(chalk.green('^regular url: ', tokenUri))
      const result = await axios.get(tokenUri.replace('gateway.pinata.cloud', 'nft-llc.mypinata.cloud'))
      return { id, contract, metadata: result.data }
    } else {
      if (tokenUri.indexOf('data:application/json;base64,') != -1) {
        const base64Parse = tokenUri.replace('data:application/json;base64,', '')

        if (isBase64(base64Parse)) {
          console.log(chalk.green('^base64'))
          return { id, contract, metadata: base64.decode(base64Parse) }
        } else {
          console.log(chalk.yellow(`^metadata non-conforming: ${tokenUri}`))
          return { id, contract, metadata: undefined }
        }
      } else {
        console.log(chalk.yellow(`^metadata non-conforming: ${tokenUri}`))
        return { id, contract, metadata: undefined }
      }
    }
  } catch (err) {
    console.log('^error while getting metadata: ', err)
    return { id, contract, metadata: undefined }
  }
}

const encodedTransferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

// TODO looping through tokenIds from 0 -> totalSupply is bad since some tokenIds don't have metadata yet
// TODO better way is to filter tokenIds by mint (0x0 tx => address)
export const populateTokenIds = async(): Promise<void> => {
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
      console.log(chalk.cyan(`tokenId => ${i}/${ethContracts.length - 1}`))
      const combinedFilter = {
        address: ethContracts[i].contract,
        topics: [
          [encodedTransferTopic],
        ],
        fromBlock: 0, // TODO optimize call later by remember which blocks we've seen?
      }

      try {
        console.log(chalk.cyan(`====> filtered transfer logs ${ethContracts[i].contract}`))

        const result = await new ethers.providers.InfuraProvider(
          'homestead',
          infuraProvider(),
        ).getLogs(combinedFilter)

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
        const totalView: string[] = tokenIds.concat(nftTrades)

        // seenMap is a birds eye view of every unique tokenId and transferHash given a contract address at the time of call
        const seenMap = totalView.reduce(function(map, obj) {
          map[obj] = true
          return map
        }, {})

        const bulkSaveNftRaw = []
        const bulkSaveNftTrade = []

        for (let j = 0; j < result.length; j++) {
          const topics = result[j].topics

          const from = defaultAbiCoder.decode(['address'] , topics[1]).toString()
          const to = defaultAbiCoder.decode(['address'] , topics[2]).toString()
          const tokenId = defaultAbiCoder.decode(['uint256'] , topics[3]).toString()

          if (!seenMap[tokenId]) {
            bulkSaveNftRaw.push({
              network: ethContracts[i].network,
              contract: ethContracts[i].contract,
              tokenId: Number(tokenId),
              type: defs.NFTType.ERC721,
            })

            seenMap[tokenId] = true
          }

          if (!seenMap[result[j].transactionHash]) {
            // save quickly for later cron job (to update metadata)
            bulkSaveNftTrade.push({
              network: ethContracts[i].network,
              contract: ethContracts[i].contract,
              transactionHash: result[j].transactionHash,
              from: from,
              to: to,
              tokenId: Number(tokenId),
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
        console.log(chalk.cyan('errLog: ', errLogs.body ?? errLogs.detail ?? errLogs))
      }
    }
  } catch (err) {
    console.log('populateTokenIds err: ', err.body ?? err)
  }
}

export const importMetaData = async(limit = 50): Promise<void> => {
  try {
    console.log('import meta data JSON')
    const validURLs = await repositories.nftRaw.find({
      where: {
        metadataURL: Not(IsNull()),
        metadata: null,
        error: null,
      },
    })

    for (let i = 0; i < validURLs.length; i += limit) {
      const requests = validURLs.filter((_, i) => i <= limit).map((object) => getMetaData(
        object.id, object.contract, object.metadataURL),
      )
  
      const result = await Promise.all(requests)
  
      // posts are ready. accumulate all the posts without duplicates
      result.map(async (data) => {
        await repositories.nftRaw.update(
          {
            id: data.id,
          },
          {
            metadata: data.metadata,
          },
        )
  
        console.log(
          chalk.yellow(
            `Updated MetaData DATA ${i}-${i + limit} / ${validURLs.length}: ${data.id}, contract: ${data.contract}`,
          ),
        )
      })

      await delay(1000)
    }
  } catch (err) {
    console.log('error importing metadata: ', err)
  }
}

export const importMetaDataURL = async(): Promise<void> => {
  try {
    console.log('@starting metadataURL imports')
    const nullTokens = await repositories.nftRaw.find({
      where: {
        metadataURL: null,
        error: null,
      },
    })

    let loops = 0
    for (let i = 0; i < nullTokens.length && loops < MAX_LOOPS; i++) {
      // get similar contract
      const filledNftRaw = await repositories.nftRaw.findOne({
        where: {
          metadataURL: !null,
          contract: nullTokens[i].contract,
        },
      })

      const errorNFT = await repositories.nftRaw.findOne({
        where: {
          error: true,
          contract: nullTokens[i].contract,
        },
      })

      if (errorNFT) {
        await repositories.nftRaw.update(
          {
            id: nullTokens[i].id,
          },
          {
            error: true,
            errorReason: errorNFT.errorReason,
          },
        )

        console.log(
          chalk.yellow(
            `Updated ERROR MetaData URL: ${nullTokens[i].contract}, tokenId=${nullTokens[i].tokenId}, errorReason=${errorNFT.errorReason}`,
          ),
        )
      } else if (!filledNftRaw || (filledNftRaw && !isUrl(filledNftRaw.metadataURL))) {
        const tokenUri = await getTokenUri(
          Number(nullTokens[i].tokenId),
          nullTokens[i].contract,
          nullTokens[i].id,
        )

        console.log(`2: ${i}/${nullTokens.length - 1}: `, tokenUri)
  
        if (tokenUri) {
          await repositories.nftRaw.update(
            {
              id: nullTokens[i].id,
            },
            {
              metadataURL: tokenUri,
            },
          )
  
          console.log(
            chalk.yellow(
              `Updated MetaData URL: ${nullTokens[i].contract}, tokenId=${nullTokens[i].tokenId}, tokenUri=${(isBase64(tokenUri) || tokenUri.indexOf('data:application/json;base64,') != -1) ? 'base64' : tokenUri}`,
            ),
          )
        }

        loops += 1
      } else {
        const modifiedTokenURL = filledNftRaw.metadataURL.replace(
          filledNftRaw.tokenId.toString(),
          nullTokens[i].tokenId.toString(),
        )

        await repositories.nftRaw.update(
          {
            id: nullTokens[i].id,
          },
          {
            metadataURL: modifiedTokenURL,
          },
        )

        console.log(
          chalk.yellow(
            `Updated MetaData URL: ${nullTokens[i].contract}, tokenId=${nullTokens[i].tokenId}, modifiedTokenURL=${modifiedTokenURL} from ${filledNftRaw.metadataURL}`,
          ),
        )
      }
    }
  } catch (err) {
    console.log('error importing metadata: ', err)
  }
}

export const getImplementationDetails = async(): Promise<void> => {
  try {
    console.log(chalk.yellow('@implementation'))
    const nullContracts = await repositories.contractInfo.find({
      where: {
        abi: null,
      },
    })

    let loop = 0
    for (let i = 0; i < nullContracts.length && loop < MAX_LOOPS; i++) {
      const proxyResult = await axios.get(`https://api.etherscan.io/api?module=contract&action=getsourcecode&address=${nullContracts[i].contract}&apikey=${provider()}`)

      if (etherscanError.includes(proxyResult.data.result)) {
        console.log(chalk.yellow(etherscanError[etherscanError.indexOf(proxyResult.data.result)] + ' ' + nullContracts[i].contract))
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
            console.log(chalk.yellow(etherscanError[etherscanError.indexOf(abiResult.data.result)] + ' ' + nullContracts[i].contract))
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
            console.log(chalk.yellow(`^ updated ${nullContracts[i].contract} with abi`))
          }
        } else {
          const abiResult = await axios.get(`https://api.etherscan.io/api?module=contract&action=getabi&address=${nullContracts[i].contract}&apikey=${provider()}`)
          const abiResultImp = await axios.get(`https://api.etherscan.io/api?module=contract&action=getabi&address=${implementation}&apikey=${provider()}`)

          if (etherscanError.includes(abiResult.data.result)) {
            console.log(chalk.yellow(etherscanError[etherscanError.indexOf(abiResult.data.result)] + ' ' + nullContracts[i].contract))
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
            console.log(chalk.yellow('imp error: ' + etherscanError[etherscanError.indexOf(abiResultImp.data.result)] + ' ' + implementation))
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
            console.log(chalk.yellow(`^ updated ${nullContracts[i].contract} with proxy/imp abi`))
          }
        }
      }

      loop += 1
    }
  } catch (err) {
    console.log(chalk.yellow('error while pulling etherscan: ', err))
  }
}

// TODO add in for contractName = null
// {
//   "inputs": [],
//   "name": "name",
//   "outputs": [
//     {
//       "internalType": "string",
//       "name": "",
//       "type": "string"
//     }
//   ],
//   "stateMutability": "view",
//   "type": "function"
// }

export const getNftLogs = async (fromBlock = 'latest', toBlock = 'latest'): Promise<void> => {
  try {
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

    console.log(chalk.green('filtered: ', rawArray.length))

    const foundInfo = await repositories.contractInfo.find({})
    const existingKeys = foundInfo.map(i => `${i.network}_${i.contract}`)
    const seenMap = existingKeys.reduce(function(map, obj) {
      map[obj] = true
      return map
    }, {})

    let loop = 0
    for (let i = 0; i < rawArray.length && loop < MAX_LOOPS; i++) {
      if (!seenMap[`Ethereum_${rawArray[i]}`]) {
        const bool721 = await is721(rawArray[i])
        const bool1155 = await is1155(rawArray[i])
        if (bool721 && bool1155) {
          nftArray.push({
            network: 'Ethereum',
            contract: rawArray[i],
            bool721: true,
            bool1155: true,
          })
          console.log(chalk.green(`====> ${i + 1}/${rawArray.length}: ${rawArray[i]}`))

          seenMap[`Ethereum_${rawArray[i]}`] = true
          loop += 1
        } else if (bool721) {
          nftArray.push({
            network: 'Ethereum',
            contract: rawArray[i],
            bool721: true,
            bool1155: false,
          })
          console.log(chalk.green(`====> ${i + 1}/${rawArray.length}: ${rawArray[i]}`))

          seenMap[`Ethereum_${rawArray[i]}`] = true
          loop += 1
        } else if (bool1155) {
          nftArray.push({
            network: 'Ethereum',
            contract: rawArray[i],
            bool721: false,
            bool1155: true,
          })
          console.log(chalk.green(`====> ${i + 1}/${rawArray.length}: ${rawArray[i]}`))

          seenMap[`Ethereum_${rawArray[i]}`] = true
          loop += 1
        } else {
          // neither => maybe non-standard NFT
          // TODO run extra tests perhaps
        }
      }
    }

    if (nftArray.length > 0) {
      await repositories.contractInfo.saveMany(nftArray)
      console.log(chalk.green(`*** SAVED ${nftArray.length} New NFTs ***`))
    } else {
      console.log(chalk.green('no new nfts'))
    }
  } catch (err) {
    console.log(`getNftLogs: ${err.body ?? err.detail ?? err}`)
  }
}

const bootstrap = (): Promise<void> => {
  verifyConfiguration()
  // console.log('dbConfig', JSON.stringify(dbConfig))
  return db.connect(dbConfig)
    .then(() => server.start())
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
