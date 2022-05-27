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

const redis = {
  host: redisConfig.host,
  port: redisConfig.port,
}
const queuePrefix = 'queue'
const GENERATE_COMPOSITE_IMAGE = 'GENERATE_COMPOSITE_IMAGE'

const queues: { [key: string]: Bull.Queue } = {}

const networkList = process.env.SUPPORTED_NETWORKS.replace('ethereum:', '').split(':')
const networks = new Map()
networks.set(
  networkList[0], // chain id
  networkList[1], // human readable network name
)

const createQueues = (): void => {
  networks.forEach((chainId: string, network: string) => {
    queues[network] = new Bull(chainId, {
      prefix: queuePrefix,
      redis,
    })
  })
  // add composite image generation job to queue...
  queues[GENERATE_COMPOSITE_IMAGE] = new Bull(GENERATE_COMPOSITE_IMAGE, {
    prefix: queuePrefix,
    redis,
  })
}

const listenToJobs = (): Promise<void[]> => {
  const values = Object.values(queues)
  return Promise.all(values.map((queue) => {
    switch (queue.name) {
    case GENERATE_COMPOSITE_IMAGE:
      return queue.process(generateCompositeImages)
    default:
      return queue.process(getEthereumEvents)
    }
  }))
}

const publishJobs = (): Promise<Bull.Job[]> => {
  createQueues()
  const chainIds = Object.keys(queues)
  return Promise.all(chainIds.map((chainId) => {
    switch (chainId) {
    case GENERATE_COMPOSITE_IMAGE:
      return queues[GENERATE_COMPOSITE_IMAGE].add({ GENERATE_COMPOSITE_IMAGE }, {
        removeOnComplete: true,
        removeOnFail: true,
        // repeat every  minute
        repeat: { every: 60000 },
        jobId: 'generate_composite_image',
      })
    default:
      return queues[chainId].add({ chainId }, {
        removeOnComplete: true,
        removeOnFail: true,
        // repeat every 10 minutes
        repeat: { every: 10 * 60000 },
        jobId: `chainid_${chainId}_job`,
      })
    }
  }))
}

export const startAndListen = (): Promise<void> => {
  return publishJobs()
    .then(() => void listenToJobs())
    .then(() => console.log('🍊 listening for jobs...'))
}

export const stopAndDisconnect = (): Promise<any> => {
  const values = Object.values(queues)
  return Promise.all(values.map((queue) => {
    return queue.obliterate({ force: true })
      .then(() => queue.close())
  }))
}
