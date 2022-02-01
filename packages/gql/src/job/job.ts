import Bull from 'bull'

import { redisConfig } from '@nftcom/gql/config'
import { getEthereumEvents } from '@nftcom/gql/job/handler'
import { getUsersNFTs } from '@nftcom/gql/job/nft.job'

const redis = {
  host: redisConfig.host,
  port: redisConfig.port,
}
const queuePrefix = 'queue'

const NFT_COLLECTION_JOB = 'nft_collection'

const queues: { [key: string]: Bull.Queue } = {}

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
}

const listenToJobs = (): Promise<void[]> => {
  const values = Object.values(queues)
  return Promise.all(values.map((queue) => {
    switch (queue.name) {
    case 'nft_collection':
      return queue.process(getUsersNFTs)
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
