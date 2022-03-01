import { Job } from 'bull'
import { utils } from 'ethers'
import { ethers } from 'ethers'
import { defaultAbiCoder } from 'ethers/lib/utils'
import Redis from 'ioredis'
import { LessThan } from 'typeorm'

import { redisConfig } from '@nftcom/gql/config'
import { _logger, contracts, db, defs, helper, provider } from '@nftcom/shared'

const logger = _logger.Factory(_logger.Context.Misc, _logger.Context.GraphQL)
const repositories = db.newRepositories()
const redis = new Redis({
  port: redisConfig.port,
  host: redisConfig.host,
})

const defaultBlock: {[chainId: number] : number} = {
  4: 10184159, // block number which marketplace contract created
}

const MAX_BLOCKS = 100000 // we use this constant to split blocks to avoid any issues to get logs for event...

/**
 * recursive method to split blocks for getting event logs
 * @param provider
 * @param fromBlock
 * @param toBlock
 * @param address
 * @param topics
 * @param currentStackLv
 */
const splitGetLogs = async (
  provider: ethers.providers.BaseProvider,
  fromBlock: number,
  toBlock: number,
  address: string,
  topics: any[],
  currentStackLv: number,
): Promise<ethers.providers.Log[]> => {
  // split block range in half...
  const midBlock =  (fromBlock.valueOf() + toBlock.valueOf()) >> 1
  // eslint-disable-next-line no-use-before-define
  const first = await getPastLogs(provider, address, topics,
    fromBlock, midBlock, currentStackLv + 1)
  // eslint-disable-next-line no-use-before-define
  const last = await getPastLogs(provider, address, topics,
    midBlock + 1, toBlock, currentStackLv + 1)
  return [...first, ...last]
}

/**
 * get past event logs
 * @param provider
 * @param address
 * @param topics
 * @param fromBlock
 * @param toBlock
 * @param currentStackLv
 */
const getPastLogs = async (
  provider: ethers.providers.BaseProvider,
  address: string,
  topics: any[],
  fromBlock: number,
  toBlock: number,
  currentStackLv = 0,
): Promise<ethers.providers.Log[]> => {
  // if there are too many recursive calls, we just return empty array...
  if (currentStackLv > 400) {
    return []
  }
  if (fromBlock > toBlock) {
    return []
  }

  try {
    // if there are too many blocks, we will split it up...
    if (toBlock - fromBlock > MAX_BLOCKS) {
      logger.debug(`getting logs from ${fromBlock} to ${toBlock}`)
      return await splitGetLogs(provider, fromBlock, toBlock, address, topics, currentStackLv)
    } else {
      // we just get logs using provider...
      logger.debug(`getting logs from ${fromBlock} to ${toBlock}`)
      const filter = {
        address: address,
        fromBlock: fromBlock,
        toBlock: toBlock,
        topics: topics,
      }
      return await provider.getLogs(filter)
    }
  } catch (e) {
    return []
  }
}

/**
 * listen to approval events
 * @param chainId
 * @param provider
 * @param cachedBlock
 * @param latestBlock
 */
const listenApprovalEvents = async (
  chainId: number,
  provider: ethers.providers.BaseProvider,
  cachedBlock: number,
  latestBlock: number,
): Promise<void[]> => {
  const address = contracts.nftMarketplaceAddress(chainId)
  const topics = [
    utils.id('Approval(bytes32,address)'),
  ]
  try {
    const logs = await getPastLogs(provider, address, topics, cachedBlock, latestBlock)
    const promises = logs.map(async (log) => {
      const structHash = log.topics[1]
      const maker = log.topics[2]

      const marketAsk = await repositories.marketAsk.findOne({
        where: {
          structHash: structHash,
          makerAddress: maker,
          approvalTxHash: null,
          cancelTxHash: null,
        },
      })
      if (marketAsk) {
        await repositories.marketAsk.updateOneById(marketAsk.id, {
          approvalTxHash: log.transactionHash,
        })
      } else {
        const marketBid = await repositories.marketBid.findOne({
          where: {
            structHash: structHash,
            makerAddress: maker,
            approvalTxHash: null,
            cancelTxHash: null,
          },
        })
        if (marketBid) {
          await repositories.marketBid.updateOneById(marketAsk.id, {
            approvalTxHash: log.transactionHash,
          })
        }
      }
    })

    await Promise.allSettled(promises)
  } catch (e) {
    logger.debug(e)
  }
  return
}

/**
 * listen to nonceIncremented events
 * @param chainId
 * @param provider
 * @param cachedBlock
 * @param latestBlock
 */
const listenNonceIncrementedEvents = async (
  chainId: number,
  provider: ethers.providers.BaseProvider,
  cachedBlock: number,
  latestBlock: number,
): Promise<void[]> => {
  const address = contracts.nftMarketplaceAddress(chainId)
  const topics = [
    utils.id('NonceIncremented(address,uint)'),
  ]
  try {
    const logs = await getPastLogs(provider, address, topics, cachedBlock, latestBlock)
    const promises = logs.map(async (log) => {
      const maker = log.topics[1]
      const nonce = log.topics[2]
      const marketAsks = await repositories.marketAsk.find({
        where: {
          makerAddress: maker,
          nonce: LessThan(nonce),
          marketSwapId: null,
          approvalTxHash: null,
          cancelTxHash: null,
        },
      })
      if (marketAsks.length) {
        await Promise.all(marketAsks.map(async (marketAsk) => {
          await repositories.marketAsk.updateOneById(marketAsk.id, {
            cancelTxHash: log.transactionHash,
          })
        }))
      } else {
        const marketBids = await repositories.marketBid.find({
          where: {
            makerAddress: maker,
            nonce: LessThan(nonce),
            marketSwapId: null,
            approvalTxHash: null,
            cancelTxHash: null,
          },
        })
        await Promise.all(marketBids.map(async (marketBid) => {
          await repositories.marketBid.updateOneById(marketBid.id, {
            cancelTxHash: log.transactionHash,
          })
        }))
      }
    })

    await Promise.allSettled(promises)
  } catch (e) {
    logger.debug(e)
  }
  return
}

/**
 * listen to cancel events
 * @param chainId
 * @param provider
 * @param cachedBlock
 * @param latestBlock
 */
const listenCancelEvents = async (
  chainId: number,
  provider: ethers.providers.BaseProvider,
  cachedBlock: number,
  latestBlock: number,
): Promise<void[]> => {
  const address = contracts.nftMarketplaceAddress(chainId)
  const topics = [
    utils.id('Cancel(byte32,address)'),
  ]
  try {
    const logs = await getPastLogs(provider, address, topics, cachedBlock, latestBlock)
    const promises = logs.map(async (log) => {
      const structHash = log.topics[1]
      const maker = log.topics[2]

      const marketAsk = await repositories.marketAsk.findOne({
        where: {
          structHash: structHash,
          makerAddress: maker,
          approvalTxHash: null,
          cancelTxHash: null,
        },
      })
      if (marketAsk) {
        // if user cancels ask listing...
        await repositories.marketAsk.updateOneById(marketAsk.id, {
          cancelTxHash: log.transactionHash,
        })
      } else {
        const marketBid = await repositories.marketBid.findOne({
          where: {
            structHash: structHash,
            makerAddress: maker,
            approvalTxHash: null,
            cancelTxHash: null,
          },
        })
        if (marketBid) {
          // if user cancels bid on ask...
          await repositories.marketBid.updateOneById(marketAsk.id, {
            cancelTxHash: log.transactionHash,
          })
        }
      }
    })

    await Promise.allSettled(promises)
  } catch (e) {
    logger.debug(e)
  }
  return
}

const parseAsset = (
  assetData: string[],
  assetClass: string[],
  assetType: string[],
): defs.MarketplaceAsset[] => {
  const asset: defs.MarketplaceAsset[] = []
  assetData.map((data, index) => {
    const parsedAssetData = defaultAbiCoder.decode(['uint256','uint256'], data)
    let assetClassData
    let assetTypeData
    switch (assetClass[index]) {
    case helper.ETH_ASSET_CLASS:
      assetClassData = defs.AssetClass.ETH
      assetTypeData = [helper.AddressZero()]
      break
    case helper.ERC20_ASSET_CLASS:
      assetClassData = defs.AssetClass.ERC20
      assetTypeData = defaultAbiCoder.decode(['address'], assetType[index])
      break
    case helper.ERC721_ASSET_CLASS:
      assetClassData = defs.AssetClass.ERC721
      assetTypeData = defaultAbiCoder.decode(['address', 'uint256', 'bool'], assetType[index])
      break
    case helper.ERC1155_ASSET_CLASS:
      assetClassData = defs.AssetClass.ERC1155
      assetTypeData = defaultAbiCoder.decode(['address', 'uint256', 'bool'], assetType[index])
      break
    default:
      break
    }
    asset.push({
      nftId: '',
      bytes: data,
      value: parsedAssetData[0],
      minimumBid: parsedAssetData[1],
      standard: {
        assetClass: assetClassData,
        bytes: assetType[index],
        contractAddress: assetTypeData[0],
        tokenId: assetTypeData[1] ? assetTypeData[1] : '',
        allowAll: assetTypeData[2] ? assetTypeData[2] : true,
      },
    })
  })

  return asset
}

/**
 * listen to match events
 * @param chainId
 * @param provider
 * @param cachedBlock
 * @param latestBlock
 */
const listenMatchEvents = async (
  chainId: number,
  provider: ethers.providers.BaseProvider,
  cachedBlock: number,
  latestBlock: number,
): Promise<void[]> => {
  const address = contracts.nftMarketplaceAddress(chainId)
  const abi = [
    'event Match(bytes32 indexed makerStructHash,bytes32 indexed takerStructHash,LibSignature.AuctionType auctionType,' +
    'Sig makerSig,Sig takerSig,bool privateSale)',
  ]
  const iface = new utils.Interface(abi)
  const topics = [
    utils.id('Match(bytes32,bytes32,LibSignature.AuctionType,Sig,Sig,bool)'),
  ]
  try {
    const logs = await getPastLogs(provider, address, topics, cachedBlock, latestBlock)
    const promises = logs.map(async (log) => {
      const event = iface.parseLog(log)
      const makerHash = log.topics[1]
      const takerHash = log.topics[2]
      const privateSale = event.args.privateSale
      const auctionType = event.args.auctionType
      const makerSig = event.args.makerSig
      const takerSig = event.args.takerSig

      let marketAsk, marketBid
      // if maker is user who made ask listing...
      marketAsk = await repositories.marketAsk.findOne({ where: { structHash: makerHash } })
      if (marketAsk) {
        marketBid = await repositories.marketBid.findOne({ where: { structHash: takerHash } })
      } else {
        // if maker is user who made bid to ask...
        marketBid = await repositories.marketBid.findOne( { where: { structHash: makerHash } })
        if (marketBid) {
          marketAsk = await repositories.marketAsk.findOne( { where: { structHash: takerHash } })
        }
      }

      if (!marketAsk || !marketBid) return
      let marketSwap = await repositories.marketSwap.findOne({
        where: {
          askId: marketAsk.id,
          bidId: marketBid.id,
        },
      })
      if (!marketSwap) {
        marketSwap = await repositories.marketSwap.save({
          askId: marketAsk.id,
          bidId: marketBid.id,
          txHash: log.transactionHash,
          blockNumber: log.blockNumber.toFixed(),
          private: helper.parseBoolean(privateSale),
        })
        await repositories.marketAsk.updateOneById(marketAsk.id, {
          marketSwapId: marketSwap.id,
          signature: {
            v: makerSig.v,
            r: makerSig.r,
            s: makerSig.s,
          },
          auctionType: auctionType as defs.AuctionType,
        })
        await repositories.marketBid.updateOneById(marketBid.id, {
          marketSwapId: marketSwap.id,
          signature: {
            v: takerSig.v,
            r: takerSig.r,
            s: takerSig.s,
          },
        })
      }
    })

    await Promise.allSettled(promises)
  } catch (e) {
    logger.debug(e)
  }
  return
}

/**
 * listen to match2A events
 * @param chainId
 * @param provider
 * @param cachedBlock
 * @param latestBlock
 */
const listenMatchTwoAEvents = async (
  chainId: number,
  provider: ethers.providers.BaseProvider,
  cachedBlock: number,
  latestBlock: number,
): Promise<void[]> => {
  const address = contracts.nftMarketplaceAddress(chainId)
  const abi = [
    'event Match2A(bytes32 indexed makerStructHash,address makerAddress,address takerAddress,' +
    'uint256 start,uint256 end,uint256 nonce,uint256 salt)',
  ]
  const iface = new utils.Interface(abi)
  const topics = [
    utils.id('Match2A(bytes32,address,address,uint256,uint256,uint256,uint256)'),
  ]
  try {
    const logs = await getPastLogs(provider, address, topics, cachedBlock, latestBlock)
    const promises = logs.map(async (log) => {
      const event = iface.parseLog(log)
      const makerHash = log.topics[1]
      const takerAddress = event.args.takerAddress
      const start = event.args.start
      const end = event.args.end
      const nonce = event.args.nonce
      const salt = event.args.salt

      const marketAsk = await repositories.marketAsk.findOne({ where: { structHash: makerHash } })
      if (!marketAsk) return

      await repositories.marketAsk.updateOneById(marketAsk.id, {
        takerAddress: takerAddress,
        start: start,
        end: end,
        nonce: nonce,
        salt: salt,
      })
    })

    await Promise.allSettled(promises)
  } catch (e) {
    logger.debug(e)
  }
  return
}

/**
 * listen to match2B events
 * @param chainId
 * @param provider
 * @param cachedBlock
 * @param latestBlock
 */
const listenMatchTwoBEvents = async (
  chainId: number,
  provider: ethers.providers.BaseProvider,
  cachedBlock: number,
  latestBlock: number,
): Promise<void[]> => {
  const address = contracts.nftMarketplaceAddress(chainId)
  const abi = [
    'event Match2B(bytes32 indexed makerStructHash,bytes[] sellerMakerOrderAssetData,bytes[] sellerMakerOrderAssetTypeData,' +
    'bytes4[] sellerMakerOrderAssetClass,bytes[] sellerTakerOrderAssetData,bytes[] sellerTakerOrderAssetTypeData,bytes4[] sellerTakerOrderAssetClass)',
  ]
  const iface = new utils.Interface(abi)
  const topics = [
    utils.id('Match2B(bytes32,bytes[],bytes[],bytes4[],bytes[],bytes[],bytes4[])'),
  ]
  try {
    const logs = await getPastLogs(provider, address, topics, cachedBlock, latestBlock)
    const promises = logs.map(async (log) => {
      const event = iface.parseLog(log)
      const makerHash = log.topics[1]

      const sellerMakerOrderAssetData = event.args[1] as string[]
      const sellerMakerOrderAssetTypeData = event.args[2] as string[]
      const sellerMakerOrderAssetClass = event.args[3] as string[]
      const sellerTakerOrderAssetData = event.args[4] as string[]
      const sellerTakerOrderAssetTypeData = event.args[5] as string[]
      const sellerTakerOrderAssetClass = event.args[6] as string[]

      const makeAsset = parseAsset(
        sellerMakerOrderAssetData,
        sellerMakerOrderAssetClass,
        sellerMakerOrderAssetTypeData,
      )
      const takeAsset = parseAsset(
        sellerTakerOrderAssetData,
        sellerTakerOrderAssetClass,
        sellerTakerOrderAssetTypeData,
      )

      const marketAsk = await repositories.marketAsk.findOne({ where: { structHash: makerHash } })
      if (!marketAsk) return

      await repositories.marketAsk.updateOneById(marketAsk.id, {
        makeAsset: makeAsset,
        takeAsset: takeAsset,
      })
    })

    await Promise.allSettled(promises)
  } catch (e) {
    logger.debug(e)
  }
  return
}

/**
 * listen to match3A events
 * @param chainId
 * @param provider
 * @param cachedBlock
 * @param latestBlock
 */
const listenMatchThreeAEvents = async (
  chainId: number,
  provider: ethers.providers.BaseProvider,
  cachedBlock: number,
  latestBlock: number,
): Promise<void[]> => {
  const address = contracts.nftMarketplaceAddress(chainId)
  const abi = [
    'event Match3A(bytes32 indexed makerStructHash,address makerAddress,address takerAddress,' +
    'uint256 start,uint256 end,uint256 nonce,uint256 salt)',
  ]
  const iface = new utils.Interface(abi)
  const topics = [
    utils.id('Match3A(bytes32,address,address,uint256,uint256,uint256,uint256)'),
  ]
  try {
    const logs = await getPastLogs(provider, address, topics, cachedBlock, latestBlock)
    const promises = logs.map(async (log) => {
      const event = iface.parseLog(log)
      const makerHash = log.topics[1]
      const takerAddress = event.args.takerAddress
      const start = event.args.start
      const end = event.args.end
      const nonce = event.args.nonce
      const salt = event.args.salt

      const marketBid = await repositories.marketBid.findOne({ where: { structHash: makerHash } })
      if (!marketBid) return

      await repositories.marketBid.updateOneById(marketBid.id, {
        takerAddress: takerAddress,
        start: start,
        end: end,
        nonce: nonce,
        salt: salt,
      })
    })

    await Promise.allSettled(promises)
  } catch (e) {
    logger.debug(e)
  }
  return
}

/**
 * listen to match3B events
 * @param chainId
 * @param provider
 * @param cachedBlock
 * @param latestBlock
 */
const listenMatchThreeBEvents = async (
  chainId: number,
  provider: ethers.providers.BaseProvider,
  cachedBlock: number,
  latestBlock: number,
): Promise<void[]> => {
  const address = contracts.nftMarketplaceAddress(chainId)
  const abi = [
    'event Match3B(bytes32 indexed makerStructHash,bytes[] buyerMakerOrderAssetData,bytes[] buyerMakerOrderAssetTypeData,' +
    'bytes4[] buyerMakerOrderAssetClass,bytes[] buyerTakerOrderAssetData,bytes[] buyerTakerOrderAssetTypeData,bytes4[] buyerTakerOrderAssetClass)',
  ]
  const iface = new utils.Interface(abi)
  const topics = [
    utils.id('Match3B(bytes32,bytes[],bytes[],bytes4[],bytes[],bytes[],bytes4[])'),
  ]
  try {
    const logs = await getPastLogs(provider, address, topics, cachedBlock, latestBlock)
    const promises = logs.map(async (log) => {
      const event = iface.parseLog(log)
      const makerHash = log.topics[1]

      const buyerMakerOrderAssetData = event.args[1] as string[]
      const buyerMakerOrderAssetTypeData = event.args[2] as string[]
      const buyerMakerOrderAssetClass = event.args[3] as string[]
      const buyerTakerOrderAssetData = event.args[4] as string[]
      const buyerTakerOrderAssetTypeData = event.args[5] as string[]
      const buyerTakerOrderAssetClass = event.args[6] as string[]

      const makeAsset = parseAsset(
        buyerMakerOrderAssetData,
        buyerMakerOrderAssetClass,
        buyerMakerOrderAssetTypeData,
      )
      const takeAsset = parseAsset(
        buyerTakerOrderAssetData,
        buyerTakerOrderAssetClass,
        buyerTakerOrderAssetTypeData,
      )

      const marketAsk = await repositories.marketBid.findOne({ where: { structHash: makerHash } })
      if (!marketAsk) return

      await repositories.marketBid.updateOneById(marketAsk.id, {
        makeAsset: makeAsset,
        takeAsset: takeAsset,
      })
    })

    await Promise.allSettled(promises)
  } catch (e) {
    logger.debug(e)
  }
  return
}

/**
 * get cached block from redis to sync marketplace events
 * @param chainId
 */
const getCachedBlock = async (chainId: number): Promise<number> => {
  try {
    const cachedBlock = await redis.get(`cached_block_${chainId}`)
    if (cachedBlock) return Number(cachedBlock)
    else return defaultBlock[chainId]
  } catch (e) {
    return defaultBlock[chainId]
  }
}

export const syncMarketplace = async (job: Job): Promise<any> => {
  try {
    logger.debug('marketplace sync job', job.data)

    const chainId = Number(job.data.chainId)
    const chainProvider = provider.provider(chainId)
    const latestBlock = await chainProvider.getBlock('latest')
    const cachedBlock = await getCachedBlock(chainId)

    await listenApprovalEvents(chainId, chainProvider, cachedBlock, latestBlock.number)
    await listenNonceIncrementedEvents(chainId, chainProvider, cachedBlock, latestBlock.number)
    await listenCancelEvents(chainId, chainProvider, cachedBlock, latestBlock.number)
    await listenMatchEvents(chainId, chainProvider, cachedBlock, latestBlock.number)
    await listenMatchTwoAEvents(chainId, chainProvider, cachedBlock, latestBlock.number)
    await listenMatchTwoBEvents(chainId, chainProvider, cachedBlock, latestBlock.number)
    await listenMatchThreeAEvents(chainId, chainProvider, cachedBlock, latestBlock.number)
    await listenMatchThreeBEvents(chainId, chainProvider, cachedBlock, latestBlock.number)
    // update cached block number to the latest block number
    await redis.set(`cached_block_${chainId}`, latestBlock.number)
  } catch (err) {
    logger.debug('error', err)
  }
}
