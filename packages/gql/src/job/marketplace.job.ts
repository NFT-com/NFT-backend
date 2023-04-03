import { Job } from 'bull'
import { BigNumber, utils } from 'ethers'
import { ethers } from 'ethers'
import { defaultAbiCoder } from 'ethers/lib/utils'
import { IsNull, LessThan } from 'typeorm'

import { cache } from '@nftcom/cache'
import { blockNumberToTimestamp } from '@nftcom/gql/defs'
import { provider } from '@nftcom/gql/helper'
import { _logger, contracts, db, defs, helper } from '@nftcom/shared'
import * as Sentry from '@sentry/node'

const logger = _logger.Factory(_logger.Context.Misc, _logger.Context.GraphQL)
const repositories = db.newRepositories()

const eventABI = contracts.marketplaceEventABI()
const marketplaceABI = contracts.marketplaceABIJSON()
const eventIface = new utils.Interface(eventABI)
const marketplaceIface = new utils.Interface(marketplaceABI)

const defaultBlock: { [chainId: number]: number } = {
  4: 10184159, // block number which marketplace contract created
}

const MAX_BLOCKS = 100000 // we use this constant to split blocks to avoid any issues to get logs for event...

/**
 * get past event logs
 * @param provider
 * @param address
 * @param topics
 * @param fromBlock
 * @param toBlock
 * @param maxBlocks
 * @param currentStackLv
 */
export const getPastLogs = async (
  provider: ethers.providers.BaseProvider,
  address: string,
  topics: any[],
  fromBlock: number,
  toBlock: number,
  maxBlocks?: number,
  currentStackLv = 0,
): Promise<ethers.providers.Log[]> => {
  // if there are too many recursive calls, we just return empty array...
  if (currentStackLv > 400) {
    return []
  }
  if (fromBlock > toBlock) {
    return []
  }

  const max_Blocks = maxBlocks ? maxBlocks : MAX_BLOCKS
  try {
    // if there are too many blocks, we will split it up...
    if (toBlock - fromBlock > max_Blocks) {
      logger.debug(`recursive getting logs from ${fromBlock} to ${toBlock}`)
      // eslint-disable-next-line no-use-before-define
      return await splitGetLogs(provider, fromBlock, toBlock, address, topics, max_Blocks, currentStackLv)
    } else {
      // we just get logs using provider...
      logger.debug(`getting logs from ${fromBlock} to ${toBlock}`)
      const filter = {
        address: utils.getAddress(address),
        fromBlock: fromBlock,
        toBlock: toBlock,
        topics: topics,
      }
      return await provider.getLogs(filter)
    }
  } catch (e) {
    logger.error('error while getting past logs: ', e)
    Sentry.captureException(e)
    Sentry.captureMessage(`Error in getPastLogs: ${e}`)
    return []
  }
}

/**
 * recursive method to split blocks for getting event logs
 * @param provider
 * @param fromBlock
 * @param toBlock
 * @param address
 * @param topics
 * @param maxBlocks
 * @param currentStackLv
 */
const splitGetLogs = async (
  provider: ethers.providers.BaseProvider,
  fromBlock: number,
  toBlock: number,
  address: string,
  topics: any[],
  maxBlocks: number,
  currentStackLv: number,
): Promise<ethers.providers.Log[]> => {
  // split block range in half...
  const midBlock = (fromBlock.valueOf() + toBlock.valueOf()) >> 1
  // eslint-disable-next-line no-use-before-define
  const first = await getPastLogs(provider, address, topics, fromBlock, midBlock, maxBlocks, currentStackLv + 1)
  // eslint-disable-next-line no-use-before-define
  const last = await getPastLogs(provider, address, topics, midBlock + 1, toBlock, maxBlocks, currentStackLv + 1)
  return [...first, ...last]
}

/**
 * listen to Approval events
 * TODO: need to confirm again once at least one approval event happens
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
  const topics = [utils.id('Approval(bytes32,address)')]
  try {
    const logs = await getPastLogs(provider, address, topics, cachedBlock, latestBlock)

    logger.debug('Approval logs', logs.length)

    const promises = logs.map(async log => {
      const event = marketplaceIface.parseLog(log)
      const structHash = event.args.structHash
      const makerAddress = event.args.maker

      const marketAsk = await repositories.marketAsk.findOne({
        where: {
          structHash: structHash,
          makerAddress: utils.getAddress(makerAddress),
          approvalTxHash: IsNull(),
          cancelTxHash: IsNull(),
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
            makerAddress: utils.getAddress(makerAddress),
            approvalTxHash: IsNull(),
            cancelTxHash: IsNull(),
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
    Sentry.captureException(e)
    Sentry.captureMessage(`Error in listenApprovalEvents: ${e}`)
  }
  return
}

/**
 * listen to NonceIncremented events
 * TODO: need to confirm again once at least one nonceIncremented event happens
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
  const topics = [utils.id('NonceIncremented(address,uint)')]
  try {
    const logs = await getPastLogs(provider, address, topics, cachedBlock, latestBlock)

    logger.debug('NonceIncremented logs', logs.length)

    const promises = logs.map(async log => {
      const event = marketplaceIface.parseLog(log)
      const makerAddress = event.args.maker
      const nonce = Number(event.args.newNonce)
      const marketAsks = await repositories.marketAsk.find({
        where: {
          makerAddress: utils.getAddress(makerAddress),
          nonce: LessThan(nonce),
          marketSwapId: IsNull(),
          approvalTxHash: IsNull(),
          cancelTxHash: IsNull(),
        },
      })
      const filteredAsks = marketAsks.filter(ask => ask.nonce < nonce)
      if (filteredAsks.length) {
        await Promise.all(
          filteredAsks.map(async marketAsk => {
            await repositories.marketAsk.updateOneById(marketAsk.id, {
              cancelTxHash: log.transactionHash,
            })
          }),
        )
      } else {
        const marketBids = await repositories.marketBid.find({
          where: {
            makerAddress: utils.getAddress(makerAddress),
            nonce: LessThan(nonce),
            marketSwapId: IsNull(),
            approvalTxHash: IsNull(),
            cancelTxHash: IsNull(),
          },
        })
        const filteredBids = marketBids.filter(bid => bid.nonce < nonce)
        await Promise.all(
          filteredBids.map(async marketBid => {
            await repositories.marketBid.updateOneById(marketBid.id, {
              cancelTxHash: log.transactionHash,
            })
          }),
        )
      }
    })

    await Promise.allSettled(promises)
  } catch (e) {
    logger.debug(e)
    Sentry.captureException(e)
    Sentry.captureMessage(`Error in nonceIncrementedEvents: ${e}`)
  }
  return
}

/**
 * listen to Cancel events
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
  const topics = [utils.id('Cancel(bytes32,address)')]
  try {
    const logs = await getPastLogs(provider, address, topics, cachedBlock, latestBlock)

    logger.debug('Cancel logs', logs.length)

    const promises = logs.map(async log => {
      const event = marketplaceIface.parseLog(log)
      const structHash = event.args.structHash
      const makerAddress = event.args.maker

      const marketAsk = await repositories.marketAsk.findOne({
        where: {
          structHash: structHash,
          makerAddress: utils.getAddress(makerAddress),
          approvalTxHash: IsNull(),
          cancelTxHash: IsNull(),
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
            makerAddress: utils.getAddress(makerAddress),
            approvalTxHash: IsNull(),
            cancelTxHash: IsNull(),
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
    Sentry.captureException(e)
    Sentry.captureMessage(`Error in listenCancelEvents: ${e}`)
  }
  return
}

const parseAsset = async (
  assetData: string[],
  assetClass: string[],
  assetType: string[],
): Promise<defs.MarketplaceAsset[]> => {
  const asset: defs.MarketplaceAsset[] = []
  const promises = assetData.map(async (data, index) => {
    const parsedAssetData = defaultAbiCoder.decode(['uint256', 'uint256'], data)
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

    // fetch ID from nft table...
    const nfts = await repositories.nft.find({
      where: {
        contract: assetTypeData[0].toLowerCase(),
      },
    })
    const nft = nfts.find(
      nft => BigNumber.from(nft.tokenId).toHexString() === (assetTypeData[1] as BigNumber).toHexString(),
    )

    asset.push({
      nftId: nft ? nft.id : '',
      bytes: data,
      value: (parsedAssetData[0] as BigNumber).toString(),
      minimumBid: (parsedAssetData[1] as BigNumber).toString(),
      standard: {
        assetClass: assetClassData,
        bytes: assetType[index],
        contractAddress: assetTypeData[0],
        tokenId: assetTypeData[1] ? (assetTypeData[1] as BigNumber).toHexString() : '',
        allowAll: assetTypeData[2] ? assetTypeData[2] : true,
      },
    })
  })

  await Promise.allSettled(promises)
  return asset
}

/**
 * listen to Match events
 * TODO: need to confirm again once at least one match event happens
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
  const address = contracts.marketplaceEventAddress(chainId)
  const topics = [utils.id('Match(bytes32,bytes32,uint8,(uint8,bytes32,bytes32),(uint8,bytes32,bytes32),bool)')]

  try {
    const logs = await getPastLogs(provider, address, topics, cachedBlock, latestBlock)

    logger.debug('Match logs', logs.length)

    const promises = logs.map(async log => {
      try {
        const event = eventIface.parseLog(log)
        const makerHash = log.topics[1]
        const takerHash = log.topics[2]
        const privateSale = event.args.privateSale
        const auctionType =
          event.args.auctionType == 0
            ? defs.AuctionType.FixedPrice
            : event.args.auctionType == 1
            ? defs.AuctionType.English
            : defs.AuctionType.Decreasing
        const makerSig = event.args.makerSig
        const takerSig = event.args.takerSig

        let marketAsk, marketBid
        marketAsk = await repositories.marketAsk.findOne({ where: { structHash: makerHash } })
        marketBid = await repositories.marketBid.findOne({ where: { structHash: takerHash } })

        if (!marketAsk) {
          marketAsk = await repositories.marketAsk.save({
            structHash: makerHash,
            nonce: -1,
            auctionType,
            signature: {
              v: makerSig.v,
              r: makerSig.r,
              s: makerSig.s,
            },
            makerAddress: '0x',
            takerAddress: '0x',
            start: -1,
            end: -1,
            salt: -1,

            // actual values
            makeAsset: [],
            takeAsset: [],
            chainId: chainId.toString(),
          })
        }

        if (!marketBid && takerHash != '0x0000000000000000000000000000000000000000000000000000000000000000') {
          marketBid = await repositories.marketBid.save({
            structHash: takerHash,
            nonce: -1,
            marketAskId: marketAsk.id,
            signature: {
              v: takerSig.v,
              r: takerSig.r,
              s: takerSig.s,
            },
            auctionType: auctionType,
            makerAddress: '0x',
            takerAddress: '0x',
            start: -1,
            end: -1,
            salt: -1,
            message: '',

            // actual values
            makeAsset: [],
            takeAsset: [],
            chainId: chainId.toString(),
          })

          logger.debug('created new marketBid ', marketBid.id)
        }
        let marketSwap = await repositories.marketSwap.findOne({
          where: {
            marketAsk: marketAsk,
            marketBid: marketBid ? marketBid : IsNull(),
            txHash: log.transactionHash,
          },
        })

        if (!marketSwap) {
          marketSwap = await repositories.marketSwap.save({
            txHash: log.transactionHash,
            blockNumber: log.blockNumber.toFixed(),
            private: helper.parseBoolean(privateSale),
            marketAsk: marketAsk,
            marketBid: marketBid,
          })
          const timestamp = await blockNumberToTimestamp(log.blockNumber, chainId.toString())
          await repositories.marketAsk.updateOneById(marketAsk.id, {
            marketSwapId: marketSwap.id,
            signature: {
              v: makerSig.v,
              r: makerSig.r,
              s: makerSig.s,
            },
            auctionType,
            offerAcceptedAt: new Date(timestamp),
          })

          if (marketBid) {
            await repositories.marketBid.updateOneById(marketBid.id, {
              marketSwapId: marketSwap.id,
              signature: {
                v: takerSig.v,
                r: takerSig.r,
                s: takerSig.s,
              },
              auctionType: auctionType,
              acceptedAt: new Date(timestamp),
            })
          }
        }
      } catch (e) {
        logger.error('error while parsing match event: ', e)
        Sentry.captureException(e)
        Sentry.captureMessage(`Error while parsing match event: ${e}`)
      }
    })

    await Promise.allSettled(promises)
  } catch (e) {
    logger.debug(e)
    Sentry.captureException(e)
    Sentry.captureMessage(`Error in listenMatchEvents: ${e}`)
  }
  return
}

/**
 * listen to Match2A events
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
  const address = contracts.marketplaceEventAddress(chainId)
  const topics = [utils.id('Match2A(bytes32,address,address,uint256,uint256,uint256,uint256)')]
  try {
    const logs = await getPastLogs(provider, address, topics, cachedBlock, latestBlock)

    logger.debug('Match2A logs', logs.length)

    const promises = logs.map(async log => {
      const event = eventIface.parseLog(log)
      const makerHash = log.topics[1]
      const makerAddress = event.args.makerAddress
      const takerAddress = event.args.takerAddress
      const start = Number(event.args.start)
      const end = Number(event.args.end)
      const nonce = Number(event.args.nonce)
      const salt = Number(event.args.salt)

      let marketAsk = await repositories.marketAsk.findOne({
        where: {
          structHash: makerHash,
        },
      })

      if (!marketAsk) {
        marketAsk = await repositories.marketAsk.save({
          structHash: makerHash,
          nonce,
          makerAddress,
          takerAddress,
          start,
          end,
          salt,
          chainId: chainId.toString(),

          // placeholder values
          auctionType: defs.AuctionType.FixedPrice,
          signature: {
            v: -1,
            r: '',
            s: '',
          },
          makeAsset: [],
          takeAsset: [],
        })

        logger.debug('created new marketAsk from Match2A ', marketAsk.id)
      } else {
        await repositories.marketAsk.updateOneById(marketAsk.id, {
          makerAddress,
          takerAddress,
          start: start,
          end: end,
          nonce: nonce,
          salt: salt,
        })

        logger.debug('updated existing marketAsk from Match2A ', marketAsk.id)
      }
    })

    await Promise.allSettled(promises)
  } catch (e) {
    logger.debug(e)
    Sentry.captureException(e)
    Sentry.captureMessage(`Error in listenMatchTwoAEvents: ${e}`)
  }
  return
}

/**
 * listen to Match2B events
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
  const address = contracts.marketplaceEventAddress(chainId)
  const topics = [utils.id('Match2B(bytes32,bytes[],bytes[],bytes4[],bytes[],bytes[],bytes4[])')]
  try {
    const logs = await getPastLogs(provider, address, topics, cachedBlock, latestBlock)

    logger.debug('Match2B logs', logs.length)

    const promises = logs.map(async log => {
      const event = eventIface.parseLog(log)

      const makerHash = log.topics[1]

      const sellerMakerOrderAssetData = event.args.sellerMakerOrderAssetData as string[]
      const sellerMakerOrderAssetTypeData = event.args.sellerMakerOrderAssetTypeData as string[]
      const sellerMakerOrderAssetClass = event.args.sellerMakerOrderAssetClass as string[]
      const sellerTakerOrderAssetData = event.args.sellerTakerOrderAssetData as string[]
      const sellerTakerOrderAssetTypeData = event.args.sellerTakerOrderAssetTypeData as string[]
      const sellerTakerOrderAssetClass = event.args.sellerTakerOrderAssetClass as string[]

      const makeAsset = await parseAsset(
        sellerMakerOrderAssetData,
        sellerMakerOrderAssetClass,
        sellerMakerOrderAssetTypeData,
      )
      const takeAsset = await parseAsset(
        sellerTakerOrderAssetData,
        sellerTakerOrderAssetClass,
        sellerTakerOrderAssetTypeData,
      )

      let marketAsk = await repositories.marketAsk.findOne({
        where: {
          structHash: makerHash,
        },
      })
      if (!marketAsk) {
        // no marketAsk -> populate
        marketAsk = await repositories.marketAsk.save({
          structHash: makerHash,
          nonce: -1,
          auctionType: defs.AuctionType.FixedPrice,
          signature: {
            v: -1,
            r: '',
            s: '',
          },
          makerAddress: '0x',
          takerAddress: '0x',
          start: -1,
          end: -1,
          salt: -1,

          // actual values
          makeAsset: makeAsset,
          takeAsset: takeAsset,
          chainId: chainId.toString(),
        })

        logger.debug('created new marketAsk from Match2B ', marketAsk.id)
      } else {
        await repositories.marketAsk.updateOneById(marketAsk.id, {
          makeAsset: makeAsset,
          takeAsset: takeAsset,
        })

        logger.debug('updated existing marketAsk from Match2B ', marketAsk.id)
      }
    })

    await Promise.allSettled(promises)
  } catch (e) {
    logger.debug(e)
    Sentry.captureException(e)
    Sentry.captureMessage(`Error in listenMatchTwoBEvents: ${e}`)
  }
  return
}

/**
 * listen to Match3A events
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
  const address = contracts.marketplaceEventAddress(chainId)
  const topics = [utils.id('Match3A(bytes32,address,address,uint256,uint256,uint256,uint256)')]
  try {
    const logs = await getPastLogs(provider, address, topics, cachedBlock, latestBlock)

    logger.debug('Match3A logs', logs.length)

    const promises = logs.map(async log => {
      const event = eventIface.parseLog(log)
      const takerHash = log.topics[1]
      const makerAddress = event.args.makerAddress
      const takerAddress = event.args.takerAddress
      const start = Number(event.args.start)
      const end = Number(event.args.end)
      const nonce = Number(event.args.nonce)
      const salt = Number(event.args.salt)

      let marketBid = await repositories.marketBid.findOne({ where: { structHash: takerHash } })
      if (!marketBid) {
        marketBid = await repositories.marketBid.save({
          structHash: takerHash,
          nonce,
          makerAddress,
          takerAddress,
          start,
          end,
          salt,
          auctionType: defs.AuctionType.FixedPrice,
          chainId: chainId.toString(),
          message: '',

          // placeholder values
          marketAskId: '-1',
          signature: {
            v: -1,
            r: '',
            s: '',
          },
          makeAsset: [],
          takeAsset: [],
        })

        logger.debug('created new marketBid Match 3A', marketBid.id)
      } else {
        await repositories.marketBid.updateOneById(marketBid.id, {
          makerAddress,
          takerAddress,
          start: start,
          end: end,
          nonce: nonce,
          salt: salt,
        })

        logger.debug('updated existing marketBid from Match3A ', marketBid.id)
      }
    })

    await Promise.allSettled(promises)
  } catch (e) {
    logger.debug(e)
    Sentry.captureException(e)
    Sentry.captureMessage(`Error in listenMatchThreeAEvents: ${e}`)
  }
  return
}

/**
 * listen to Match3B events
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
  const address = contracts.marketplaceEventAddress(chainId)
  const topics = [utils.id('Match3B(bytes32,bytes[],bytes[],bytes4[],bytes[],bytes[],bytes4[])')]
  try {
    const logs = await getPastLogs(provider, address, topics, cachedBlock, latestBlock)

    logger.debug('Match3B logs', logs.length)

    const promises = logs.map(async log => {
      const event = eventIface.parseLog(log)
      const takerHash = log.topics[1]

      const buyerMakerOrderAssetData = event.args.buyerMakerOrderAssetData as string[]
      const buyerMakerOrderAssetTypeData = event.args.buyerMakerOrderAssetTypeData as string[]
      const buyerMakerOrderAssetClass = event.args.buyerMakerOrderAssetClass as string[]
      const buyerTakerOrderAssetData = event.args.buyerTakerOrderAssetData as string[]
      const buyerTakerOrderAssetTypeData = event.args.buyerTakerOrderAssetTypeData as string[]
      const buyerTakerOrderAssetClass = event.args.buyerTakerOrderAssetClass as string[]

      const makeAsset = await parseAsset(
        buyerMakerOrderAssetData,
        buyerMakerOrderAssetClass,
        buyerMakerOrderAssetTypeData,
      )
      const takeAsset = await parseAsset(
        buyerTakerOrderAssetData,
        buyerTakerOrderAssetClass,
        buyerTakerOrderAssetTypeData,
      )

      let marketBid = await repositories.marketBid.findOne({ where: { structHash: takerHash } })
      if (!marketBid) {
        marketBid = await repositories.marketBid.save({
          structHash: takerHash,
          nonce: -1,
          marketAskId: '',
          signature: {
            v: -1,
            r: '',
            s: '',
          },
          makerAddress: '0x',
          takerAddress: '0x',
          start: -1,
          end: -1,
          salt: -1,

          // actual values
          makeAsset: makeAsset,
          takeAsset: takeAsset,
          auctionType: defs.AuctionType.FixedPrice,
          chainId: chainId.toString(),
        })

        logger.debug('created new marketBid Match 3B', marketBid.id)
      } else {
        await repositories.marketBid.updateOneById(marketBid.id, {
          makeAsset: makeAsset,
          takeAsset: takeAsset,
        })

        logger.debug('updated existing marketBid from Match3B ', marketBid.id)
      }
    })

    await Promise.allSettled(promises)
  } catch (e) {
    logger.debug(e)
    Sentry.captureException(e)
    Sentry.captureMessage(`Error in listenMatchThreeBEvents: ${e}`)
  }
  return
}

/**
 * listen to BuyNowInfo events
 * @param chainId
 * @param provider
 * @param cachedBlock
 * @param latestBlock
 */
const listenBuyNowInfoEvents = async (
  chainId: number,
  provider: ethers.providers.BaseProvider,
  cachedBlock: number,
  latestBlock: number,
): Promise<void[]> => {
  const address = contracts.marketplaceEventAddress(chainId)
  const topics = [utils.id('BuyNowInfo(bytes32,address)')]
  try {
    const logs = await getPastLogs(provider, address, topics, cachedBlock, latestBlock)

    logger.debug('BuyNowInfo logs', logs.length)

    const promises = logs.map(async log => {
      const event = eventIface.parseLog(log)

      const makerHash = log.topics[1]
      const takerAddress = event.args.takerAddress

      const marketAsk = await repositories.marketAsk.findOne({ where: { structHash: makerHash } })
      if (marketAsk) {
        await repositories.marketAsk.updateOneById(marketAsk.id, {
          buyNowTaker: utils.getAddress(takerAddress),
        })

        logger.debug('updated existing marketAsk from BuyNowInfo ', marketAsk.id)
      }
    })

    await Promise.allSettled(promises)
  } catch (e) {
    logger.debug(e)
    Sentry.captureException(e)
    Sentry.captureMessage(`Error in listenBuyNowInfoEvents: ${e}`)
  }
  return
}

/**
 * get cached block from redis to sync marketplace events
 * @param chainId
 * @param key
 */
const getCachedBlock = async (chainId: number, key: string): Promise<number> => {
  try {
    const cachedBlock = await cache.get(key)

    // get 1000 blocks before incase of some blocks not being handled correctly
    if (cachedBlock) return Number(cachedBlock) > 10000 ? Number(cachedBlock) - 10000 : Number(cachedBlock)
    else return defaultBlock[chainId]
  } catch (e) {
    Sentry.captureException(e)
    Sentry.captureMessage(`Error in getCachedBlock in marketplace: ${e}`)
    return defaultBlock[chainId]
  }
}

export const syncMarketplace = async (job: Job): Promise<any> => {
  try {
    logger.debug('marketplace sync job', job.data)

    const chainId = Number(job.data.chainId)
    const chainProvider = provider.provider(chainId)
    const latestBlock = await chainProvider.getBlock('latest')
    const cachedBlock = await getCachedBlock(chainId, `cached_block_${chainId}`)

    await listenApprovalEvents(chainId, chainProvider, cachedBlock, latestBlock.number)
    await listenNonceIncrementedEvents(chainId, chainProvider, cachedBlock, latestBlock.number)
    await listenCancelEvents(chainId, chainProvider, cachedBlock, latestBlock.number)

    await listenMatchTwoAEvents(chainId, chainProvider, cachedBlock, latestBlock.number)
    await listenMatchTwoBEvents(chainId, chainProvider, cachedBlock, latestBlock.number)
    await listenMatchThreeAEvents(chainId, chainProvider, cachedBlock, latestBlock.number)
    await listenMatchThreeBEvents(chainId, chainProvider, cachedBlock, latestBlock.number)
    await listenMatchEvents(chainId, chainProvider, cachedBlock, latestBlock.number)
    await listenBuyNowInfoEvents(chainId, chainProvider, cachedBlock, latestBlock.number)
    // update cached block number to the latest block number
    await cache.set(`cached_block_${chainId}`, latestBlock.number)
  } catch (err) {
    logger.debug('error', err)

    Sentry.captureMessage(`Error in syncMarketplace: ${err}`)
  }
}
