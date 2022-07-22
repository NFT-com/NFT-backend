
import Bull, { Job } from 'bull'

import { _logger, db } from '@nftcom/shared'

// exported for tests
export const repositories = db.newRepositories()
const logger = _logger.Factory(_logger.Context.Misc, _logger.Context.GraphQL)
import { cache, CacheKeys, removeExpiredTimestampedZsetMembers, ttlForTimestampedZsetMembers } from '@nftcom/gql/service/cache.service'
import { OpenseaOrderRequest, retrieveMultipleOrdersOpensea } from '@nftcom/gql/service/opensea.service'
import { NFT } from '@nftcom/shared/db/entity'
import { bigNumber } from '@nftcom/shared/helper/misc'
import * as Sentry from '@sentry/node'

import { nftCronSubqueue } from './job'

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
  try {
    const { offset, limit } = job.data
    const chainId: string =  job.data?.chainId || '4'
    const nfts: NFT[] = await repositories.nft.find({
      where: { chainId, deletedAt: null },
      select: ['contract', 'tokenId', 'chainId'],
      skip: offset,
      take: limit,
    })

    if (nfts.length) {
      const nftRequest: Array<OpenseaOrderRequest> = nfts.map((nft: any) => ({
        contract: nft.contract,
        tokenId: bigNumber(nft.tokenId).toString(),
        chainId: nft.chainId,
      }))
      
      const { listings }= await retrieveMultipleOrdersOpensea(nftRequest, chainId, false)
      await repositories.txList.saveMany(listings)
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
    const chainId: string =  job.data?.chainId || '4'

    const nftCount: number = await repositories.nft.count({ chainId, deletedAt: null })
    const limit: number = MAX_PROCESS_BATCH_SIZE
    let offset = 0
    // sub-queue assignmemt

    //sub-queue job additions
    for (let i=0; i < nftCount; i+=MAX_PROCESS_BATCH_SIZE) {
      offset = i
      nftCronSubqueue.add({ offset, limit, chainId }, {
        ...subQueueBaseOptions,
        jobId: `nft-batch-processor|offset:${offset}|limit:${limit}-chainId:${chainId}`,
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
    const chainId: string =  job.data?.chainId || '4'
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
        const tokenId: string = bigNumber(nftSplit?.[1]).toString()
        return {
          contract,
          tokenId,
          chainId,
        }
      })
      
      const openseaServiceResponse = await retrieveMultipleOrdersOpensea(nftRequest, chainId, false)

      const { listings } = openseaServiceResponse

      await repositories.txList.saveMany(listings)

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
    console.log('err', err)
    Sentry.captureMessage(`Error in nftExternalOrdersOnDemand Job: ${err}`)
  }
}