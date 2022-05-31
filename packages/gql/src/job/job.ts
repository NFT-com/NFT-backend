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
// import { getUsersNFTs } from '@nftcom/gql/job/nft.job'
// import { syncProfileNFTs } from '@nftcom/gql/job/profile.job'
// DISABLE MARKETPLACE/TYPESENSE JOBS UNTIL READY
// import { syncMarketplace } from '@nftcom/gql/job/marketplace.job'
// import { typesenseCollectionSchemas } from '@nftcom/gql/job/typesense.job'

const BULL_MAX_REPEAT_COUNT = parseInt(process.env.BULL_MAX_REPEAT_COUNT) || 250

const redis = {
  host: redisConfig.host,
  port: redisConfig.port,
}
const queuePrefix = 'queue'
const GENERATE_COMPOSITE_IMAGE = 'GENERATE_COMPOSITE_IMAGE'

const queues = new Map<string, Bull.Queue>()

const networkList = process.env.SUPPORTED_NETWORKS.replace('ethereum:', '').split(':')
const networks = new Map()
networks.set(
  networkList[0], // chain id
  networkList[1], // human readable network name
)

let isListening: boolean

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
    return Promise.all(values.map((queue) => {
      return queue.obliterate({ force: true })
    })).then(() => true)
  }

  for (const network of networks.keys()) {
    const queue = queues.get(network)
    const job = jobs.flat().find(job => job.queue === queue)
    if (( job.opts.repeat
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore: @types/bull is outdated
          && (job.opts.repeat.count >= BULL_MAX_REPEAT_COUNT || jobHasNotRunRecently(job)))
        || !job.opts.repeat) {
      return Promise.all(values.map((queue) => {
        return queue.obliterate({ force: true })
      })).then(() => true)
    }
  }

  return new Promise(resolve => resolve(false))
}

const publishJobs = (shouldPublish: boolean): Promise<boolean> => {
  if (shouldPublish) {
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
          // repeat every 10 minutes
          repeat: { every: 10 * 60000 },
          jobId: `chainid_${chainId}_job`,
        })
      }
    })).then(() => shouldPublish)
  }

  return new Promise(resolve => resolve(false))
}

const listenToJobs = (shouldListen: boolean): Promise<boolean> => {
  isListening = shouldListen
  if (shouldListen) {
    const values = [...queues.values()]
    return Promise.all(values.map((queue) => {
      switch (queue.name) {
      case GENERATE_COMPOSITE_IMAGE:
        return queue.process(generateCompositeImages)
      default:
        return queue.process(getEthereumEvents)
      }
    })).then(() => shouldListen)
  }
  
  return new Promise(resolve => resolve(false))
}

export const startAndListen = (): Promise<void> => {
  return createQueues()
    .then(() => getExistingJobs())
    .then((jobs) => checkJobQueues(jobs))
    .then((shouldPublish) => publishJobs(shouldPublish))
    .then((shouldListen) => void listenToJobs(shouldListen))
    .then(() => isListening ? console.log('🍊 listening for jobs...') : console.log('🍊 no jobs to listen to this time...'))
}

export const stopAndDisconnect = (): Promise<any> => {
  const values = [...queues.values()]
  return Promise.all(values.map((queue) => {
    return queue.close()
  }))
}
