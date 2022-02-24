import { Job } from 'bull'
import { utils } from 'ethers'
import { ethers } from 'ethers'
import { LessThan } from 'typeorm'

import { _logger, db, provider } from '@nftcom/shared'
import { parseBoolean } from '@nftcom/shared/helper/misc'

const logger = _logger.Factory(_logger.Context.Misc, _logger.Context.GraphQL)

const repositories = db.newRepositories()

const marketContract: {[chainId: number]: string} = {
  [4]: '0xA3509a064A54a7a60Fc4Db0245ef44F812f439f6',
}

let cachedBlock = -1

const listenApprovalEvents = async (
  chainId: number,
  chainProvider: ethers.providers.BaseProvider,
): Promise<void[]> => {
  const latestBlock = await chainProvider.getBlock('latest')
  const filter = {
    address: marketContract[chainId],
    fromBlock: cachedBlock,
    toBlock: latestBlock.number,
    topics: [
      utils.id('Approval(bytes32,address,address)'),
    ],
  }
  try {
    const logs = await chainProvider.getLogs(filter)
    const promises = logs.map(async (log) => {
      const hash = log.topics[1]
      const maker = log.topics[2]

      const marketAsk = await repositories.marketAsk.findOne({
        where: {
          structHash: hash,
          makerAddress: maker,
        },
      })
      if (marketAsk) {
        await repositories.marketAsk.updateOneById(marketAsk.id, {
          approvalTxHash: log.transactionHash,
        })
      } else {
        const marketBid = await repositories.marketBid.findOne({
          where: {
            structHash: hash,
            makerAddress: maker,
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
  chainProvider: ethers.providers.BaseProvider,
): Promise<void[]> => {
  const latestBlock = await chainProvider.getBlock('latest')
  const filter = {
    address: marketContract[chainId],
    fromBlock: cachedBlock,
    toBlock: latestBlock.number,
    topics: [
      utils.id('NonceIncremented(address,uint)'),
    ],
  }
  try {
    const logs = await chainProvider.getLogs(filter)
    const promises = logs.map(async (log) => {
      const maker = log.topics[1]
      const nonce = log.topics[2]
      const marketAsks = await repositories.marketAsk.find({
        where: {
          makerAddress: maker,
          nonce: LessThan(nonce),
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
  chainProvider: ethers.providers.BaseProvider,
): Promise<void[]> => {
  const latestBlock = await chainProvider.getBlock('latest')
  const filter = {
    address: marketContract[chainId],
    fromBlock: cachedBlock,
    toBlock: latestBlock.number,
    topics: [
      utils.id('Cancel(byte32,address)'),
    ],
  }
  try {
    const logs = await chainProvider.getLogs(filter)
    const promises = logs.map(async (log) => {
      const hash = log.topics[1]
      const maker = log.topics[2]

      const marketAsk = await repositories.marketAsk.findOne({
        where: {
          structHash: hash,
          makerAddress: maker,
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
            structHash: hash,
            makerAddress: maker,
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
  chainProvider: ethers.providers.BaseProvider,
): Promise<void[]> => {
  const latestBlock = await chainProvider.getBlock('latest')
  const filter = {
    address: marketContract[chainId],
    fromBlock: cachedBlock,
    toBlock: latestBlock.number,
    topics: [
      utils.id('Match(bytes32,bytes32,address,address,uint256,uint256,bool)'),
    ],
  }
  try {
    const logs = await chainProvider.getLogs(filter)
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
      const marketSwap = await repositories.marketSwap.findOne({
        where: {
          askId: marketAsk.id,
          bidId: marketBid.id,
        },
      })
      if (!marketSwap) {
        await repositories.marketSwap.save({
          askId: marketAsk.id,
          bidId: marketBid.id,
          txHash: log.transactionHash,
          blockNumber: log.blockNumber.toFixed(),
          private: parseBoolean(privateSale),
        })
      }
    })

    await Promise.allSettled(promises)
  } catch (e) {
    console.log(e)
  }
  return
}

export const syncMarketplace = async (job: Job): Promise<any> => {
  try {
    logger.debug('marketplace sync job', job.data)
    const chainId = Number(job.data.chainId)
    const chainProvider = provider.provider(chainId)

    await listenApprovalEvents(chainId, chainProvider)
    await listenNonceIncrementedEvents(chainId, chainProvider)
    await listenCancelEvents(chainId, chainProvider)
    await listenMatchEvents(chainId, chainProvider)

    const latestBlock = await chainProvider.getBlock('latest')
    cachedBlock = latestBlock.number
  } catch (err) {
    console.log('error', err)
  }
}
