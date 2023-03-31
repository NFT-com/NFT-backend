import axios from 'axios'

import { cache } from '@nftcom/cache'
import { updateContractStats } from '@nftcom/contract-data'
import { updateCollectionLeaderboard } from '@nftcom/leaderboard'
import { db } from '@nftcom/shared'

import { getConnection } from './data-source'

const envMap = {
  production: 'prod-api.nft.com',
  staging: 'staging-api.nft.com',
  development: 'dev-api.nft.com',
  local: 'localhost',
}
const gqlClient = axios.create({
  baseURL: `https://${envMap[process.env.NODE_ENV]}`,
})
const leaderboardQuery =
  'query CollectionLeaderboard($input: CollectionLeaderboardInput)' +
  ' {\n  collectionLeaderboard(input: $input) {\n    items {\n      contract\n    }\n  }\n}'

export const cacheStats = async (): Promise<void> => {
  await getConnection()
  const collectionRepo = db.newRepositories().collection
  const collections = await collectionRepo.findAllOfficial()
  await updateContractStats(collections)
  await updateCollectionLeaderboard(collectionRepo)
  await cache.del([
    'COLLECTION_LEADERBOARD_HYDRATED_24h',
    'COLLECTION_LEADERBOARD_HYDRATED_7d',
    'COLLECTION_LEADERBOARD_HYDRATED_30d',
    'COLLECTION_LEADERBOARD_HYDRATED_all',
  ])
  await Promise.all([
    gqlClient.post('/graphql', {
      query: leaderboardQuery,
      variables: {
        input: {
          dateRange: '24h',
        },
      },
    }),
    gqlClient.post('/graphql', {
      query: leaderboardQuery,
      variables: {
        input: {
          dateRange: '7d',
        },
      },
    }),
    gqlClient.post('/graphql', {
      query: leaderboardQuery,
      variables: {
        input: {
          dateRange: '30d',
        },
      },
    }),
    gqlClient.post('/graphql', {
      query: leaderboardQuery,
      variables: {
        input: {
          dateRange: 'all',
        },
      },
    }),
  ])
}
