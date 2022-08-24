import Redis from 'ioredis'

import { redisConfig } from '@nftcom/gql/config'

let redis: Redis
const DEFAULT_TTL_HOURS = 2

export enum CacheKeys {
  REFRESH_NFT_ORDERS_EXT = 'refresh_nft_orders_ext',
  REFRESHED_NFT_ORDERS_EXT = 'refreshed_nft_orders_ext',
  UPDATE_NFT_FOR_ASSOCIATED_WALLET = 'update_nft_for_associated_wallet',
  GENESIS_KEY_OWNERS = 'genesis_key_owners',
  ASSOCIATED_ADDRESSES = 'associated_addresses',
  ASSOCIATED_CONTRACT = 'associated_contract',
  REFRESH_NFT = 'refresh_nft',
  LEADERBOARD_RESPONSE = 'Leaderboard_response',
  CACHED_GKS = 'cached_gks',
  GET_GK = 'get_gk',
  SORTED_PROFILES_BY_VISIBLE_NFTS = 'sorted_profiles_by_visible_nfts',
}

export const ttlForTimestampedZsetMembers = (ttl?: Date): number => {
  const currentTime: Date = new Date(ttl? ttl: Date.now())
  if (!ttl) {
    currentTime.setHours(currentTime.getHours() + DEFAULT_TTL_HOURS)
  }
  return currentTime.getTime()
}

// for expired set members
export const removeExpiredTimestampedZsetMembers = (
  zSetKey: string,
  expireTill?: number): Promise<number> => {
  const dateNow: number = Date.now()
  const expireTillCondition: boolean = new Date(expireTill) < new Date(dateNow)
  const expirationTime = expireTill && expireTillCondition? expireTill: dateNow
  if (redis) {
    return redis.zremrangebyscore(zSetKey, '-inf', expirationTime)
  }
  return Promise.resolve(0)
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
