import Redis from 'ioredis'

import { redisConfig } from '@nftcom/gql/config'

let redis: Redis

const createCacheConnection = (): void => {
  redis = new Redis({
    host: redisConfig.host,
    port: redisConfig.port,
  })
}

// create connection on first import
if (!redis) {
  createCacheConnection()
}

export const cache = redis