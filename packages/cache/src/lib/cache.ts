import Redis from 'ioredis'

import { redisConfig } from './config'

let redis: Redis
const DEFAULT_TTL_MINS = Number(process.env.DEFAULT_TTL_MINS) || 15 // 15 mins

export enum CacheKeys {
  REFRESH_NFT_ORDERS_EXT = 'refresh_nft_orders_ext',
  REFRESHED_NFT_ORDERS_EXT = 'refreshed_nft_orders_ext',
  UPDATED_NFTS_PROFILE = 'updated_nfts_profile',
  UPDATE_NFTS_PROFILE = 'update_nfts_profile',
  UPDATE_NFT_FOR_ASSOCIATED_WALLET = 'update_nft_for_associated_wallet',
  GENESIS_KEY_OWNERS = 'genesis_key_owners',
  ASSOCIATED_ADDRESSES = 'associated_addresses',
  ASSOCIATED_CONTRACT = 'associated_contract',
  REFRESH_NFT = 'refresh_nft',
  LEADERBOARD_RESPONSE = 'Leaderboard_response',
  CACHED_GKS = 'cached_gks',
  GET_GK = 'get_gk',
  SORTED_PROFILES_BY_VISIBLE_NFTS = 'sorted_profiles_by_visible_nfts',
  PROFILES_MINTED_BY_GK = 'profiles_minted_by_gk',
}

export const ttlForTimestampedZsetMembers = (ttl?: Date): number => {
  const currentTime: Date = new Date(ttl? ttl: Date.now())
  if (!ttl) {
    currentTime.setMinutes(currentTime.getMinutes() + DEFAULT_TTL_MINS)
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

export const createCacheConnection = (): void => {
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
