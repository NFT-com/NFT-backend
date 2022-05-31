import { ethers } from 'ethers'

import { _logger, contracts, db, provider } from '@nftcom/shared'
import * as Sentry from '@sentry/node'

const logger = _logger.Factory(_logger.Context.Misc, _logger.Context.GraphQL)

export enum AskOrBid {
  Ask = 'MARKET_ASK',
  Bid = 'MARKET_BID',
}

/**
 * do validation on txHash and return block number if it's valid for cancelMarketAsk or cancelMarketBid
 * @param txHash
 * @param chainId
 * @param id
 * @param askOrBid
 */
export const validateTxHashForCancel = async (
  txHash: string,
  chainId: string,
  id: string,
  askOrBid: AskOrBid,
): Promise<boolean> => {
  try {
    const chainProvider = provider.provider(Number(chainId))
    const repositories = db.newRepositories()
    // check if tx hash has been executed...
    const tx = await chainProvider.getTransaction(txHash)
    if (!tx.confirmations)
      return false

    const sourceReceipt = await tx.wait()
    const abi = contracts.marketplaceABIJSON()
    const iface = new ethers.utils.Interface(abi)
    let eventEmitted = false

    const topic = ethers.utils.id('Cancel(bytes32,address)')
    // look through events of tx and check it contains Cancel event...
    // if it contains Cancel event, then we validate if id is correct one...
    await Promise.all(
      sourceReceipt.logs.map(async (log) => {
        if (log.topics[0] === topic) {
          const event = iface.parseLog(log)
          if (event.name === 'Cancel') {
            const makerHash = event.args.structHash
            const makerAddress = event.args.maker
            let entity
            // if id is marketAskId...
            if (askOrBid === AskOrBid.Ask) {
              entity = await repositories.marketAsk.findOne({
                where: {
                  id: id,
                  structHash: makerHash,
                  makerAddress: ethers.utils.getAddress(makerAddress),
                },
              })
            } else {
              // if id is marketBidId...
              entity = await repositories.marketBid.findOne({
                where: {
                  id: id,
                  structHash: makerHash,
                  makerAddress: ethers.utils.getAddress(makerAddress),
                },
              })
            }
            eventEmitted = (entity !== undefined)
          }
        }
      }))
    return eventEmitted
  } catch (e) {
    logger.debug(`${txHash} is not valid`, e)
    Sentry.captureException(e)
    Sentry.captureMessage(`Error in validateTxHashForCancel: ${e}`)
    return false
  }
}
