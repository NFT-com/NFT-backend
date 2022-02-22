import { Job } from 'bull'
import { utils } from 'ethers'

import { _logger, db, provider } from '@nftcom/shared'
import { parseBoolean } from '@nftcom/shared/helper/misc'

const logger = _logger.Factory(_logger.Context.Misc, _logger.Context.GraphQL)

const repositories = db.newRepositories()

const marketContract: {[chainId: number]: string} = {
  [4]: '0xA3509a064A54a7a60Fc4Db0245ef44F812f439f6',
}

const listenApprovalEvents = async (chainId: number): Promise<void[]> => {
  const chainProvider = provider.provider(chainId)
  const latestBlock = await chainProvider.getBlock('latest')
  const filter = {
    address: marketContract[chainId],
    fromBlock: 0,
    toBlock: latestBlock.number,
    topics: [
      utils.id('Approval(bytes32,address,address)'),
    ],
  }
  try {
    const logs = await chainProvider.getLogs(filter)
    logs.map(async (log) => {
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
  } catch (e) {
    console.log(e)
  }
  return
}

const listenCancelEvents = async (chainId: number): Promise<void[]> => {
  const chainProvider = provider.provider(chainId)
  const latestBlock = await chainProvider.getBlock('latest')
  const filter = {
    address: marketContract[chainId],
    fromBlock: 0,
    toBlock: latestBlock.number,
    topics: [
      utils.id('Cancel(bytes32,address,address)'),
    ],
  }
  try {
    const logs = await chainProvider.getLogs(filter)
    logs.map(async (log) => {
      const txHash = log.topics[1]
      const maker = log.topics[2]
      const taker = log.topics[3]

      const marketAsk = await repositories.marketAsk.findOne({ where: { makerAddress: maker } })
      // if takers cancel their bid...
      if (taker) {
        const marketBid = await repositories.marketBid.findOne({
          where: {
            makerAddress: maker,
            takerAddress: taker,
          },
        })
        await repositories.marketBid.updateOneById(marketBid.id, { cancelTxHash: txHash })
      } else if (!taker) {
        // if maker cancel ask listing...
        await repositories.marketAsk.updateOneById(marketAsk.id, {
          cancelTxHash: txHash,
        })
      }
    })
  } catch (e) {
    console.log(e)
  }
  return
}

const listenMatchEvents = async (chainId: number): Promise<void[]> => {
  const chainProvider = provider.provider(chainId)
  const latestBlock = await chainProvider.getBlock('latest')
  const filter = {
    address: marketContract[chainId],
    fromBlock: 0,
    toBlock: latestBlock.number,
    topics: [
      utils.id('Match(bytes32,bytes32,address,address,uint256,uint256,bool)'),
    ],
  }
  try {
    const logs = await chainProvider.getLogs(filter)
    logs.map(async (log) => {
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
  } catch (e) {
    console.log(e)
  }
  return
}

export const syncMarketplace = async (job: Job): Promise<any> => {
  try {
    logger.debug('marketplace sync job', job.data)
    const chainId = Number(job.data.chainId)
    await listenApprovalEvents(chainId)
    await listenCancelEvents(chainId)
    await listenMatchEvents(chainId)
  } catch (err) {
    console.log('error', err)
  }
}
