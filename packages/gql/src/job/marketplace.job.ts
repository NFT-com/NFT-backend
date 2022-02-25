import { Job } from 'bull'
import { utils } from 'ethers'
import { ethers } from 'ethers'
import { LessThan } from 'typeorm'

import { _logger, contracts, db, helper,provider } from '@nftcom/shared'

const logger = _logger.Factory(_logger.Context.Misc, _logger.Context.GraphQL)

const repositories = db.newRepositories()

const cachedBlock: {[chainId: number] : number} = {
  4: 10184159, // block number which marketplace contract created
}

const listenApprovalEvents = async (
  chainId: number,
  chainProvider: ethers.providers.BaseProvider,
  latestBlock: number,
): Promise<void[]> => {
  const address = contracts.nftMarketplaceAddress(chainId)
  const filter = {
    address: address,
    fromBlock: cachedBlock[chainId],
    toBlock: latestBlock,
    topics: [
      utils.id('Approval(bytes32,address)'),
    ],
  }
  try {
    const logs = await chainProvider.getLogs(filter)
    const promises = logs.map(async (log) => {
      const structHash = log.topics[1]
      const maker = log.topics[2]

      const marketAsk = await repositories.marketAsk.findOne({
        where: {
          structHash: structHash,
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
            structHash: structHash,
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
  latestBlock: number,
): Promise<void[]> => {
  const address = contracts.nftMarketplaceAddress(chainId)
  const filter = {
    address: address,
    fromBlock: cachedBlock[chainId],
    toBlock: latestBlock,
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
          marketSwapId: null,
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
  latestBlock: number,
): Promise<void[]> => {
  const address = contracts.nftMarketplaceAddress(chainId)
  const filter = {
    address: address,
    fromBlock: cachedBlock[chainId],
    toBlock: latestBlock,
    topics: [
      utils.id('Cancel(byte32,address)'),
    ],
  }
  try {
    const logs = await chainProvider.getLogs(filter)
    const promises = logs.map(async (log) => {
      const structHash = log.topics[1]
      const maker = log.topics[2]

      const marketAsk = await repositories.marketAsk.findOne({
        where: {
          structHash: structHash,
          makerAddress: maker,
          marketSwapId: null,
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
  latestBlock: number,
): Promise<void[]> => {
  const address = contracts.nftMarketplaceAddress(chainId)
  const filter = {
    address: address,
    fromBlock: cachedBlock[chainId],
    toBlock: latestBlock,
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

export const syncMarketplace = async (job: Job): Promise<any> => {
  try {
    logger.debug('marketplace sync job', job.data)
    const chainId = Number(job.data.chainId)
    const chainProvider = provider.provider(chainId)
    const latestBlock = await chainProvider.getBlock('latest')

    await listenApprovalEvents(chainId, chainProvider, latestBlock.number)
    await listenNonceIncrementedEvents(chainId, chainProvider, latestBlock.number)
    await listenCancelEvents(chainId, chainProvider, latestBlock.number)
    await listenMatchEvents(chainId, chainProvider, latestBlock.number)
    // update cached block number to the latest block number
    cachedBlock[chainId] = latestBlock.number
  } catch (err) {
    console.log('error', err)
  }
}
