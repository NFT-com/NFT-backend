import Bull from 'bull'

import { redisConfig } from '@nftcom/gql/config'
import { getEthereumEvents } from '@nftcom/gql/job/handler'
import { getUsersNFTs } from '@nftcom/gql/job/nft.job'
import { syncProfileNFTs } from '@nftcom/gql/job/profile.job'

const redis = {
  host: redisConfig.host,
  port: redisConfig.port,
}
const queuePrefix = 'queue'

const NFT_COLLECTION_JOB = 'nft_collection'
const PROFILE_SYNC_JOB = 'profile_sync:4' // 4 = chainId

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
}

const listenToJobs = (): Promise<void[]> => {
  const values = Object.values(queues)
  return Promise.all(values.map((queue) => {
    switch (queue.name) {
    case NFT_COLLECTION_JOB:
      return queue.process(getUsersNFTs)
    case PROFILE_SYNC_JOB:
      return queue.process(syncProfileNFTs)
    default:
      return queue.process(getEthereumEvents)
    }
  }))
}

const publishJobs = (): Promise<Bull.Job[]> => {
  const chainIds = Object.keys(queues)
  return Promise.all(chainIds.map((chainId) => {
    switch (chainId) {
    case NFT_COLLECTION_JOB:
      return queues[NFT_COLLECTION_JOB].add({ NFT_COLLECTION_JOB }, {
        removeOnComplete: true,
        removeOnFail: true,
        // repeat every 10 minutes for nft collection job
        repeat: { every: 600000 },
      })
    case PROFILE_SYNC_JOB:
      return queues[PROFILE_SYNC_JOB].add({ chainId: PROFILE_SYNC_JOB.split(':')?.[1] }, {
        removeOnComplete: true,
        removeOnFail: true,
        // repeat every 5 minutes for nft collection job
        repeat: { every: 300000 },
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
  createQueues()
  return publishJobs()
    .then(() => void listenToJobs())
    .then(() => console.log('🍊 listening for jobs...'))
}

export const stopAndDisconnect = (): Promise<any> => {
  const values = Object.values(queues)
  return Promise.all(values.map((queue) => {
    return queue.empty()
      .then(() => queue.close(false))
  }))
}
