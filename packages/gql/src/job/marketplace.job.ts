import { Job } from 'bull'
import { utils } from 'ethers'
import { ethers } from 'ethers'
import Redis from 'ioredis'
import { LessThan } from 'typeorm'

import { redisConfig } from '@nftcom/gql/config'
import { _logger, contracts, db, helper,provider } from '@nftcom/shared'

const logger = _logger.Factory(_logger.Context.Misc, _logger.Context.GraphQL)
const repositories = db.newRepositories()
const redis = new Redis({
  port: redisConfig.port,
  host: redisConfig.host,
})

const defaultBlock: {[chainId: number] : number} = {
  4: 10184159, // block number which marketplace contract created
}

const maxBlocks = 100000

const splitGetLogs = async (
  provider: ethers.providers.BaseProvider,
  fromBlock: number,
  toBlock: number,
  address: string,
  topics: any[],
  currentStackLv: number,
): Promise<ethers.providers.Log[]> => {
  const midBlock =  (fromBlock.valueOf() + toBlock.valueOf()) >> 1
  // eslint-disable-next-line no-use-before-define
  const first = await getPastLogs(provider, address, topics,
    fromBlock, midBlock, currentStackLv + 1)
  // eslint-disable-next-line no-use-before-define
  const last = await getPastLogs(provider, address, topics,
    midBlock + 1, toBlock, currentStackLv + 1)
  return [...first, ...last]
}

const getPastLogs = async (
  provider: ethers.providers.BaseProvider,
  address: string,
  topics: any[],
  fromBlock: number,
  toBlock: number,
  currentStackLv = 0,
): Promise<ethers.providers.Log[]> => {
  if (currentStackLv > 400) {
    return []
  }
  if (fromBlock > toBlock) {
    return []
  }

  try {
    // if there are too many blocks, we will break it up...
    if (toBlock - fromBlock > maxBlocks) {
      console.log(`getting logs from ${fromBlock} to ${toBlock}`)
      return await splitGetLogs(provider, fromBlock, toBlock, address, topics, currentStackLv)
    } else {
      console.log(`getting logs from ${fromBlock} to ${toBlock}`)
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
    console.log(e)
  }
  return
}

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
    console.log(e)
  }
  return
}

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
    console.log(e)
  }
  return
}

const listenMatchEvents = async (
  chainId: number,
  provider: ethers.providers.BaseProvider,
  cachedBlock: number,
  latestBlock: number,
): Promise<void[]> => {
  const address = contracts.nftMarketplaceAddress(chainId)
  const topics = [
    utils.id('Match(bytes32,bytes32,address,address,uint256,uint256,bool)'),
  ]
  try {
    const logs = await getPastLogs(provider, address, topics, cachedBlock, latestBlock)
    const promises = logs.map(async (log) => {
      const makerHash = log.topics[1]
      const takerHash = log.topics[2]
      const privateSale = log.topics[7]

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
        })
        await repositories.marketBid.updateOneById(marketBid.id, {
          marketSwapId: marketSwap.id,
        })
      }
    })

    await Promise.allSettled(promises)
  } catch (e) {
    console.log(e)
  }
  return
}

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
    // update cached block number to the latest block number
    await redis.set(`cached_block_${chainId}`, latestBlock.number)
  } catch (err) {
    console.log('error', err)
  }
}
