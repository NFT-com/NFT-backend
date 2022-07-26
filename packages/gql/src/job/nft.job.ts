
import Bull, { Job } from 'bull'

import { cache, CacheKeys, removeExpiredTimestampedZsetMembers, ttlForTimestampedZsetMembers } from '@nftcom/gql/service/cache.service'
import { OpenseaExternalOrder, OpenseaOrderRequest, retrieveMultipleOrdersOpensea } from '@nftcom/gql/service/opensea.service'
import { _logger, db } from '@nftcom/shared'
import { helper } from '@nftcom/shared'
import { NFT, TxBid, TxList } from '@nftcom/shared/db/entity'
import { ExchangeType } from '@nftcom/shared/defs'
import * as Sentry from '@sentry/node'

import { LooksrareExternalOrder, retrieveMultipleOrdersLooksrare } from '../service/looksare.service'
import { nftCronSubqueue } from './job'

// exported for tests
export const repositories = db.newRepositories()
const logger = _logger.Factory(_logger.Context.Misc, _logger.Context.GraphQL)

const MAX_PROCESS_BATCH_SIZE = 1500

const subQueueBaseOptions: Bull.JobOptions = {
  attempts: 3,
  removeOnComplete: true,
  removeOnFail: true,
  backoff: {
    type: 'exponential',
    delay: 2000,
  },
}

//batch processor
const nftExternalOrderBatchProcessor = async (job: Job): Promise<void> => {
  logger.debug(`initiated external orders for ${job.data.exchange} | series: ${job.data.offset} | batch:  ${job.data.limit}`)
  try {
    const { offset, limit, exchange } = job.data
    const chainId: string =  job.data?.chainId || process.env.CHAIN_ID
    const nfts: NFT[] = await repositories.nft.find({
      where: { chainId, deletedAt: null },
      select: ['contract', 'tokenId', 'chainId'],
      skip: offset,
      take: limit,
    })

    if (nfts.length && exchange) {
      const nftRequest: Array<OpenseaOrderRequest> = nfts.map((nft: any) => ({
        contract: nft.contract,
        tokenId: helper.bigNumber(nft.tokenId).toString(),
        chainId: nft.chainId,
      }))

      const persistActivity = []
      let openseaResponse: OpenseaExternalOrder
      let looksrareResponse: LooksrareExternalOrder

      switch (exchange) {
      case ExchangeType.OpenSea:
        openseaResponse = await retrieveMultipleOrdersOpensea(nftRequest, chainId, false)

        // listings
        if (openseaResponse.listings.length) {
          persistActivity.push(repositories.txList.saveMany(openseaResponse.listings))
        }
         
        // offers
        if (openseaResponse.offers.length) {
          persistActivity.push(repositories.txBid.saveMany(openseaResponse.offers))
        }
        break
      case ExchangeType.LooksRare:
        looksrareResponse = await retrieveMultipleOrdersLooksrare(nftRequest, chainId, true)
  
        // listings
        if (looksrareResponse.listings.length) {
          persistActivity.push(repositories.txList.saveMany(looksrareResponse.listings))
        }

        // offers
        if (looksrareResponse.offers.length) {
          persistActivity.push(repositories.txBid.saveMany(looksrareResponse.offers))
        }
        break
      }

      // settlements should not depend on each other
      await Promise.allSettled(persistActivity)
      logger.debug(`completed external orders for ${job.data.exchange} | series: ${job.data.offset} | batch:  ${job.data.limit}`)
    }
  } catch (err) {
    Sentry.captureMessage(`Error in nftExternalOrders Job: ${err}`)
  }
}

export const nftExternalOrders = async (job: Job): Promise<void> => {
  logger.debug('initiated external orders for nfts', job.data)
  try {
    if (!nftCronSubqueue) {
      await job.moveToFailed({ message: 'nft-cron-queue is not defined!' })
    }
    // const chainId: string =  job.data?.chainId || process.env.CHAIN_ID
    const chainId = '1'

    const nftCount: number = await repositories.nft.count({ chainId, deletedAt: null })
    const limit: number = MAX_PROCESS_BATCH_SIZE
    let offset = 0
    // sub-queue assignmemt

    //sub-queue job additions
    for (let i=0; i < nftCount; i+=MAX_PROCESS_BATCH_SIZE) {
      offset = i
      // opensea
      nftCronSubqueue.add({ offset, limit, chainId, exchange: ExchangeType.OpenSea }, {
        ...subQueueBaseOptions,
        jobId: `nft-batch-processor-opensea|offset:${offset}|limit:${limit}-chainId:${chainId}`,
      })

      // looksrare
      nftCronSubqueue.add({ offset, limit, chainId, exchange: ExchangeType.LooksRare  }, {
        ...subQueueBaseOptions,
        jobId: `nft-batch-processor-looksrare|offset:${offset}|limit:${limit}-chainId:${chainId}`,
      })
    }

    const existingJobs: Bull.Job[] = await nftCronSubqueue.getJobs(['active', 'completed', 'delayed', 'failed', 'paused', 'waiting'])

    // clear existing jobs
    if (existingJobs.flat().length) {
      nftCronSubqueue.obliterate({ force: true })
    }
     
    // process subqueues in series; hence concurrency is explicitly set to one for rate limits
    nftCronSubqueue.process(1, nftExternalOrderBatchProcessor)

    logger.debug('updated external orders for nfts')
  } catch (err) {
    Sentry.captureMessage(`Error in nftExternalOrders Job: ${err}`)
  }
}

export const nftExternalOrdersOnDemand = async (job: Job): Promise<void> => {
  logger.debug('external orders on demand', job.data)
  try {
    const chainId: string =  job.data?.chainId || process.env.CHAIN_ID
    await removeExpiredTimestampedZsetMembers(
      `${CacheKeys.REFRESHED_NFT_ORDERS_EXT}_${chainId}`,
      Date.now(),
    )
    const cachedNfts = await cache.zrevrangebyscore(`${CacheKeys.REFRESH_NFT_ORDERS_EXT}_${chainId}`, '+inf', '(0')

    const nfts: Array<string> = []

    for (const item of cachedNfts) {
      const itemPresentInRefreshedCache: string = await cache.zscore(`${CacheKeys.REFRESHED_NFT_ORDERS_EXT}_${chainId}`, item)

      // item is not present in refresh cache
      if(!itemPresentInRefreshedCache) {
        nfts.push(item)
      }
    }

    if (nfts.length) {
      const nftRequest: Array<OpenseaOrderRequest> = nfts.map((nft: string) => {
        const nftSplit: Array<string> = nft.split(':')
        const contract: string = nftSplit?.[0]
        const tokenId: string = helper.bigNumber(nftSplit?.[1]).toString()
        return {
          contract,
          tokenId,
          chainId,
        }
      })
      
      // settlements should not depend on each other
      const [opensea, looksrare] = await Promise.allSettled([
        retrieveMultipleOrdersOpensea(nftRequest, chainId, false),
        retrieveMultipleOrdersLooksrare(nftRequest,chainId, true),
      ])

      const listings: TxList[] = []
      const bids: TxBid[] = []
      const persistActivity: any[] = []

      if (opensea.status === 'fulfilled') {
        // opensea listings
        if (opensea.value.listings.length) {
          listings.push(...opensea.value.listings)
        }

        // opensea offers
        if (opensea.value.offers.length) {
          bids.push(...opensea.value.offers)
        }
      }

      if (looksrare.status === 'fulfilled') {
        // looksrare listings
        if (looksrare.value.listings.length) {
          listings.push(...looksrare.value.listings)
        }

        // looksrare offers
        if (looksrare.value.offers.length) {
          bids.push(...looksrare.value.offers)
        }
      }

      // save listings
      if (listings.length) {
        persistActivity.push(repositories.txList.saveMany(listings))
      }

      // save bids
      if (bids.length) {
        persistActivity.push(repositories.txBid.saveMany(bids))
      }

      await Promise.all(persistActivity)

      // set ttl for timestamp members
      const TTL: number = ttlForTimestampedZsetMembers()
      const refreshedOrders  = nfts.reduce((acc, curr) => {
        acc.push(...[TTL, curr])
        return acc
      }, [])
      await Promise.all([
        cache.zadd(
          `${CacheKeys.REFRESHED_NFT_ORDERS_EXT}_${chainId}`,
          ...refreshedOrders,
        ),
        cache.zremrangebyscore(`${CacheKeys.REFRESH_NFT_ORDERS_EXT}_${chainId}`, 1, '+inf'),
      ])
    }
     
    logger.debug('updated external orders for nfts - on demand')
  } catch (err) {
    Sentry.captureMessage(`Error in nftExternalOrdersOnDemand Job: ${err}`)
  }
}