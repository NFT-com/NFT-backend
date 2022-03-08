import Bull from 'bull'

import { redisConfig } from '@nftcom/gql/config'
import {
  MARKETPLACE_SYNC_JOB,
  NFT_COLLECTION_JOB,
  PROFILE_SYNC_JOB,
  TYPESENSE_INDEX_SCHEMA_JOB,
} from '@nftcom/gql/job/constants.job'
import { getEthereumEvents } from '@nftcom/gql/job/handler'
import { syncMarketplace } from '@nftcom/gql/job/marketplace.job'
import { getUsersNFTs } from '@nftcom/gql/job/nft.job'
import { syncProfileNFTs } from '@nftcom/gql/job/profile.job'
import { typesenseCollectionSchemas } from '@nftcom/gql/job/typesense.job'

const redis = {
  host: redisConfig.host,
  port: redisConfig.port,
}
const queuePrefix = 'queue'

const queues: { [key: string]: Bull.Queue } = {}

// TODO: make sure to add mainnet before going live
const networks = new Map()
networks.set('4', 'rinkeby')

const createQueues = (): void => {
  networks.forEach((val: string, key: string) => {
    queues[key] = new Bull(val, {
      prefix: queuePrefix,
      redis,
    })
  })
  // add users nft collection job to queue...
  queues[NFT_COLLECTION_JOB] = new Bull(NFT_COLLECTION_JOB, {
    prefix: queuePrefix,
    redis,
  })

  queues[PROFILE_SYNC_JOB] = new Bull(PROFILE_SYNC_JOB, {
    prefix: queuePrefix,
    redis,
  })

  queues[MARKETPLACE_SYNC_JOB] = new Bull(MARKETPLACE_SYNC_JOB, {
    prefix: queuePrefix,
    redis,
  })

  queues[TYPESENSE_INDEX_SCHEMA_JOB] = new Bull(TYPESENSE_INDEX_SCHEMA_JOB, {
    prefix: queuePrefix,
    redis,
  })
}

const listenToJobs = (): Promise<void[]> => {
  const values = Object.values(queues)
  return Promise.all(values.map((queue) => {
    switch (queue.name) {
    case NFT_COLLECTION_JOB:
      return queue.process(getUsersNFTs)
    case PROFILE_SYNC_JOB:
      return queue.process(syncProfileNFTs)
    case MARKETPLACE_SYNC_JOB:
      return queue.process(syncMarketplace)
    case TYPESENSE_INDEX_SCHEMA_JOB:
      return queue.process(typesenseCollectionSchemas)
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
    case NFT_COLLECTION_JOB:
      return queues[NFT_COLLECTION_JOB].add({ NFT_COLLECTION_JOB }, {
        removeOnComplete: true,
        removeOnFail: true,
        // repeat every 10 minutes for nft collection job
        repeat: { every: 60000 * 2 },
      })
    case PROFILE_SYNC_JOB:
      return queues[PROFILE_SYNC_JOB].add({ chainId: PROFILE_SYNC_JOB.split(':')?.[1] }, {
        removeOnComplete: true,
        removeOnFail: true,
        // repeat every 2 minutes for nft profile job
        repeat: { every: 60000 * 2 },
      })
    case MARKETPLACE_SYNC_JOB:
      return queues[MARKETPLACE_SYNC_JOB].add({ chainId: MARKETPLACE_SYNC_JOB.split(':')?.[1] }, {
        removeOnComplete: true,
        removeOnFail: true,
        // repeat every 1 minute for nft marketplace job
        repeat: { every: 60000 * 1 },
      })
    case TYPESENSE_INDEX_SCHEMA_JOB:
      return queues[TYPESENSE_INDEX_SCHEMA_JOB].add({ TYPESENSE_INDEX_SCHEMA_JOB }, {
        priority: 1,
        removeOnComplete: true,
        removeOnFail: true,
        // no repeat options, only run once with top prio 
      })
    default:
      return queues[chainId].add({ chainId }, {
        removeOnComplete: true,
        removeOnFail: true,
        // repeat every minute
        repeat: { every: 60000 },
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
    return queue.obliterate( { force: true })
      .then(() => queue.close())
  }))
}
