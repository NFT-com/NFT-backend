import Bull from 'bull'

import { redisConfig } from '@nftcom/gql/config'
import {
//MARKETPLACE_SYNC_JOB,
// NFT_COLLECTION_JOB,
// PROFILE_SYNC_JOB,
//TYPESENSE_INDEX_SCHEMA_JOB,
} from '@nftcom/gql/job/constants.job'
import { getEthereumEvents } from '@nftcom/gql/job/handler'
import { generateCompositeImages } from '@nftcom/gql/job/profile.job'
import { _logger } from '@nftcom/shared'
// import { getUsersNFTs } from '@nftcom/gql/job/nft.job'
// import { syncProfileNFTs } from '@nftcom/gql/job/profile.job'
// DISABLE MARKETPLACE/TYPESENSE JOBS UNTIL READY
// import { syncMarketplace } from '@nftcom/gql/job/marketplace.job'
// import { typesenseCollectionSchemas } from '@nftcom/gql/job/typesense.job'

const BULL_MAX_REPEAT_COUNT = parseInt(process.env.BULL_MAX_REPEAT_COUNT) || 250

const logger = _logger.Factory(_logger.Context.Bull)

const redis = {
  host: redisConfig.host,
  port: redisConfig.port,
}
const queuePrefix = 'queue'
const GENERATE_COMPOSITE_IMAGE = 'GENERATE_COMPOSITE_IMAGE'

const queues = new Map<string, Bull.Queue>()

const networkList = process.env.SUPPORTED_NETWORKS.split('|')
const networks = new Map()
networkList.map(network => networks.set(
  network.replace('ethereum:', '').split(':')[0], // chain id
  network.replace('ethereum:', '').split(':')[1], // human readable network name
))

let didPublish: boolean

const createQueues = (): Promise<void> => {
  return new Promise((resolve) => {
    networks.forEach((chainId: string, network: string) => {
      queues.set(network, new Bull(chainId, {
        prefix: queuePrefix,
        redis,
      }))
    })
    
    // add composite image generation job to queue...
    queues.set(GENERATE_COMPOSITE_IMAGE, new Bull(GENERATE_COMPOSITE_IMAGE, {
      prefix: queuePrefix,
      redis,
    }))
    resolve()
  })
}

const getExistingJobs = (): Promise<Bull.Job[][]> => {
  const values = [...queues.values()]
  return Promise.all(values.map((queue) => {
    return queue.getJobs(['active', 'completed', 'delayed', 'failed', 'paused', 'waiting'])
  }))
}

const jobHasNotRunRecently = (job: Bull.Job<any>): boolean  => {
  const currentMillis = Date.now()
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore: @types/bull is outdated
  return currentMillis > (job.opts.repeat.every * 1.2) + job.opts.prevMillis
}

const checkJobQueues = (jobs: Bull.Job[][]): Promise<boolean> => {
  const values = [...queues.values()]
  if (jobs.flat().length < queues.size) {
    logger.info('🐮 fewer bull jobs than queues -- wiping queues for restart')
    return Promise.all(values.map((queue) => {
      return queue.obliterate({ force: true })
    })).then(() => true)
  }

  for (const network of networks.keys()) {
    const queue = queues.get(network)
    const job = jobs.flat().find(job => job.queue === queue)
    if ((job.opts.repeat
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore: @types/bull is outdated
          && (job.opts.repeat.count >= BULL_MAX_REPEAT_COUNT || jobHasNotRunRecently(job)))
        || !job.opts.repeat) {
      logger.info('🐮 bull job needs to restart -- wiping queues for restart')
      return Promise.all(values.map((queue) => {
        return queue.obliterate({ force: true })
      })).then(() => true)
    }
  }

  return new Promise(resolve => resolve(false))
}

const publishJobs = (shouldPublish: boolean): Promise<void> => {
  if (shouldPublish) {
    didPublish = true
    const chainIds = [...queues.keys()]
    return Promise.all(chainIds.map((chainId) => {
      switch (chainId) {
      case GENERATE_COMPOSITE_IMAGE:
        return queues.get(GENERATE_COMPOSITE_IMAGE).add({ GENERATE_COMPOSITE_IMAGE }, {
          removeOnComplete: true,
          removeOnFail: true,
          // repeat every  2 minutes
          repeat: { every: 2 * 60000 },
          jobId: 'generate_composite_image',
        })
      default:
        return queues.get(chainId).add({ chainId }, {
          removeOnComplete: true,
          removeOnFail: true,
          // repeat every 3 minutes
          repeat: { every: 3 * 60000 },
          jobId: `chainid_${chainId}_job`,
        })
      }
    })).then(() => undefined)
  }

  return new Promise(resolve => resolve(undefined))
}

const listenToJobs = async (): Promise<void> => {
  for (const queue of queues.values()) {
    switch (queue.name) {
    case GENERATE_COMPOSITE_IMAGE:
      queue.process(generateCompositeImages)
      break
    default:
      queue.process(getEthereumEvents)
    }
  }
}

export const startAndListen = (): Promise<void> => {
  return createQueues()
    .then(() => getExistingJobs())
    .then((jobs) => checkJobQueues(jobs))
    .then((shouldPublish) => publishJobs(shouldPublish))
    .then(() => listenToJobs())
    .then(() => {
      setTimeout(() => {
        didPublish ? logger.info('🍊 queue was restarted -- listening for jobs...')
          : logger.info('🍊 queue is healthy -- listening for jobs...')
      })
    })
}

export const stopAndDisconnect = (): Promise<any> => {
  const values = [...queues.values()]
  return Promise.all(values.map((queue) => {
    return queue.close()
  }))
}
