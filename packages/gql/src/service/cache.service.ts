import Redis from 'ioredis'

import { redisConfig } from '@nftcom/gql/config'

let redis: Redis

export enum CacheKeys {
  REFRESH_NFT_ORDERS_EXT = 'refresh_nft_orders_ext',
  REFRESHED_NFT_ORDERS_EXT = 'refreshed_nft_orders_ext'
}

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