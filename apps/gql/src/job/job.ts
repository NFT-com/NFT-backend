import Bull from 'bull'

import { cache, redisConfig } from '@nftcom/cache'
import { _logger } from '@nftcom/shared'
import * as Sentry from '@sentry/node'

import { getEthereumEvents } from './handler'
import { nftExternalOrdersOnDemand } from './nft.job'
import { generateCompositeImages } from './profile.job'

const BULL_MAX_REPEAT_COUNT = parseInt(process.env.BULL_MAX_REPEAT_COUNT) || 250
// const NFT_EXTERNAL_ORDER_REFRESH_DURATION = Number(
//  process.env.NFT_EXTERNAL_ORDER_REFRESH_DURATION,
// ) || 720 // by default 12 hours

const logger = _logger.Factory(_logger.Context.Bull)

export const redis = {
  host: redisConfig.host,
  port: redisConfig.port,
}
const queuePrefix = 'queue'

enum QUEUE_TYPES {
  GENERATE_COMPOSITE_IMAGE = 'GENERATE_COMPOSITE_IMAGE',
  FETCH_EXTERNAL_ORDERS = 'FETCH_EXTERNAL_ORDERS',
  FETCH_EXTERNAL_ORDERS_ON_DEMAND = 'FETCH_EXTERNAL_ORDERS_ON_DEMAND',
}

const queues = new Map<string, Bull.Queue>()

// nft cron subqueue
// const subqueuePrefix = 'nft-cron'
// const subqueueName = 'nft-batch-processor'

export const nftCronSubqueue: Bull.Queue = null

const networkList = process.env.SUPPORTED_NETWORKS.split('|')
const networks = new Map()
networkList.map(network => {
  return networks.set(
    network.replace('ethereum:', '').split(':')[0], // chain id
    network.replace('ethereum:', '').split(':')[1], // human readable network name
  )
})

let didPublish: boolean

const createQueues = (): Promise<void> => {
  return new Promise(resolve => {
    networks.forEach((chainId: string, network: string) => {
      queues.set(
        network,
        new Bull(chainId, {
          prefix: queuePrefix,
          redis,
        }),
      )
    })

    // add composite image generation job to queue...
    queues.set(
      QUEUE_TYPES.GENERATE_COMPOSITE_IMAGE,
      new Bull(QUEUE_TYPES.GENERATE_COMPOSITE_IMAGE, {
        prefix: queuePrefix,
        redis,
      }),
    )

    // external orders cron
    // queues.set(QUEUE_TYPES.FETCH_EXTERNAL_ORDERS, new Bull(
    //   QUEUE_TYPES.FETCH_EXTERNAL_ORDERS, {
    //     prefix: queuePrefix,
    //     redis,
    //   }))

    // cron subqueue
    // nftCronSubqueue = new Bull(subqueueName, {
    //   redis: redis,
    //   prefix: subqueuePrefix,
    // })

    // external orders on demand
    queues.set(
      QUEUE_TYPES.FETCH_EXTERNAL_ORDERS_ON_DEMAND,
      new Bull(QUEUE_TYPES.FETCH_EXTERNAL_ORDERS_ON_DEMAND, {
        prefix: queuePrefix,
        redis,
      }),
    )

    resolve()
  })
}

const getExistingJobs = (): Promise<Bull.Job[][]> => {
  const values = [...queues.values()]
  return Promise.all(
    values.map(queue => {
      return queue.getJobs(['active', 'completed', 'delayed', 'failed', 'paused', 'waiting'])
    }),
  )
}

const jobHasNotRunRecently = (job: Bull.Job<any>): boolean => {
  const currentMillis = Date.now()
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore: @types/bull is outdated
  return currentMillis > job.opts.repeat.every * 1.2 + job.opts.prevMillis
}

const checkJobQueues = (jobs: Bull.Job[][]): Promise<boolean> => {
  const values = [...queues.values()]
  if (jobs.flat().length < queues.size) {
    logger.info('🐮 fewer bull jobs than queues -- wiping queues for restart')
    return Promise.all(
      values.map(queue => {
        return queue.obliterate({ force: true })
      }),
    ).then(() => {
      // if all jobs need to restart, we can set preview link cache key as true to be available
      return cache.set('generate_preview_link_available', JSON.stringify(true)).then(() => true)
    })
  }

  for (const network of networks.keys()) {
    const queue = queues.get(network)
    const job = jobs.flat().find(job => job.queue === queue)
    if (
      (job.opts.repeat &&
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore: @types/bull is outdated
        (job.opts.repeat.count >= BULL_MAX_REPEAT_COUNT || jobHasNotRunRecently(job))) ||
      !job.opts.repeat
    ) {
      logger.info('🐮 bull job needs to restart -- wiping queues for restart')
      return Promise.all(
        values.map(queue => {
          return queue.obliterate({ force: true })
        }),
      ).then(() => {
        // if all jobs need to restart, we can set preview link cache key as true to be available
        return cache.set('generate_preview_link_available', JSON.stringify(true)).then(() => true)
      })
    }
  }

  return new Promise(resolve => resolve(false))
}

const publishJobs = (shouldPublish: boolean): Promise<void> => {
  if (shouldPublish) {
    didPublish = true
    const chainIds = [...queues.keys()]
    return Promise.all(
      chainIds.map(chainId => {
        switch (chainId) {
          case QUEUE_TYPES.GENERATE_COMPOSITE_IMAGE:
            return queues.get(QUEUE_TYPES.GENERATE_COMPOSITE_IMAGE).add(
              { GENERATE_COMPOSITE_IMAGE: QUEUE_TYPES.GENERATE_COMPOSITE_IMAGE },
              {
                removeOnComplete: true,
                removeOnFail: true,
                // repeat every  2 minutes
                repeat: { every: 2 * 60000 },
                jobId: 'generate_composite_image',
              },
            )
          // case QUEUE_TYPES.FETCH_EXTERNAL_ORDERS:
          //   return queues.get(QUEUE_TYPES.FETCH_EXTERNAL_ORDERS)
          //     .add({
          //       FETCH_EXTERNAL_ORDERS: QUEUE_TYPES.FETCH_EXTERNAL_ORDERS,
          //       chainId: process.env.CHAIN_ID,
          //     }, {
          //       removeOnComplete: true,
          //       removeOnFail: true,
          //       // repeat every  6 hrs - configurable
          //       repeat: { every: NFT_EXTERNAL_ORDER_REFRESH_DURATION * 60000 },
          //       jobId: 'fetch_external_orders',
          //     })
          case QUEUE_TYPES.FETCH_EXTERNAL_ORDERS_ON_DEMAND:
            return queues.get(QUEUE_TYPES.FETCH_EXTERNAL_ORDERS_ON_DEMAND).add(
              {
                FETCH_EXTERNAL_ORDERS_ON_DEMAND: QUEUE_TYPES.FETCH_EXTERNAL_ORDERS_ON_DEMAND,
                chainId: process.env.CHAIN_ID,
              },
              {
                attempts: 5,
                removeOnComplete: true,
                removeOnFail: true,
                backoff: {
                  type: 'exponential',
                  delay: 2000,
                },
                // repeat every  2 minutes
                repeat: { every: 2 * 60000 },
                jobId: 'fetch_external_orders_on_demand',
              },
            )
          default:
            return queues.get(chainId).add(
              { chainId },
              {
                removeOnComplete: true,
                removeOnFail: true,
                // repeat every 3 minutes
                repeat: { every: 3 * 60000 },
                jobId: `chainid_${chainId}_job`,
              },
            )
        }
      }),
    ).then(() => undefined)
  }

  return new Promise(resolve => resolve(undefined))
}

const listenToJobs = async (): Promise<void> => {
  for (const queue of queues.values()) {
    switch (queue.name) {
      case QUEUE_TYPES.GENERATE_COMPOSITE_IMAGE:
        queue.process(generateCompositeImages)
        break
      case QUEUE_TYPES.FETCH_EXTERNAL_ORDERS:
        // queue.process(nftExternalOrders)
        break
      case QUEUE_TYPES.FETCH_EXTERNAL_ORDERS_ON_DEMAND:
        queue.process(nftExternalOrdersOnDemand)
        break
      default:
        queue.process(getEthereumEvents)
    }
  }
}

export const obliterateQueue = async (queueName: string): Promise<string> => {
  try {
    const queue = new Bull(queueName, {
      prefix: queuePrefix,
      redis,
    })
    await queue.obliterate({ force: true })
    return 'Job is obliterated.'
  } catch (err) {
    logger.error(`Error in obliterateQueue: ${err}`)
    Sentry.captureMessage(`Error in obliterateQueue: ${err}`)
    throw err
  }
}

export const startAndListen = (): Promise<void> => {
  return createQueues()
    .then(() => getExistingJobs())
    .then(jobs => checkJobQueues(jobs))
    .then(shouldPublish => publishJobs(shouldPublish))
    .then(() => listenToJobs())
    .then(() => {
      setTimeout(() => {
        didPublish
          ? logger.info('🍊 queue was restarted -- listening for jobs...')
          : logger.info('🍊 queue is healthy -- listening for jobs...')
      })
    })
}

export const stopAndDisconnect = (): Promise<any> => {
  const values = [...queues.values()]

  // close cron sub-queue
  if (nftCronSubqueue) {
    values.push(nftCronSubqueue)
  }
  return Promise.all(
    values.map(queue => {
      return queue.close()
    }),
  )
}
