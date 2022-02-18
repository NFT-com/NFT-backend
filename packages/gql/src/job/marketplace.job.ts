import { Job } from 'bull'
import { utils } from 'ethers'

import { _logger, db, provider } from '@nftcom/shared'

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
      const txHash = log.topics[1]
      const maker = log.topics[2]
      const taker = log.topics[3]

      const marketAsk = await repositories.marketAsk.findOne({ where: { makerAddress: maker } })
      await repositories.marketAsk.updateOneById(marketAsk.id, {
        approvalTxHash: txHash,
      })
      const marketBid = await repositories.marketBid.findOne({
        where: {
          makerAddress: maker,
          takerAddress: taker,
        },
      })
      await repositories.marketBid.updateOneById(marketBid.id, { approvalTxHash: txHash })
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
      utils.id('Match(bytes32,bytes32,address,address,uint256,uint256,uint256,uint256,bool)'),
    ],
  }
  const logs = await chainProvider.getLogs(filter)
  console.log(logs)
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
