import { DataSource } from 'typeorm'

import { testDBConfig } from '@nftcom/misc'
import { db, defs } from '@nftcom/shared'
import { Profile, User } from '@nftcom/shared/db/entity'

import { testMockProfiles, testMockWallet, testMockWatchlistUser } from '../util/constants'
import { clearDB } from '../util/helpers'
import { getTestApolloServer } from '../util/testApolloServer'

jest.setTimeout(300000)
jest.retryTimes(2)

jest.mock('@nftcom/cache', () => ({
  redisConfig: {},
  cache: jest.fn(),
  createCacheConnection: jest.fn(),
}))

let testServer
let connection: DataSource

const repositories = db.newRepositories()

describe('watchlist resolver', () => {
  beforeAll(async () => {
    connection = await db.connectTestDB(testDBConfig)

    testServer = getTestApolloServer(repositories, testMockWatchlistUser, testMockWallet)
  })

  afterAll(async () => {
    jest.clearAllMocks()
    await testServer.stop()

    if (!connection) return
    await connection.destroy()
  })

  describe('add to watchlist', () => {
    beforeAll(async () => {
      const user: User = testMockWatchlistUser as User
      const profile: Profile = testMockProfiles as Profile

      await Promise.all([repositories.user.save(user), repositories.profile.save(profile)])
    })

    afterAll(async () => {
      await clearDB(repositories)
      await testServer.stop()
    })

    it('should add to watchlist', async () => {
      const result = await testServer.executeOperation({
        query: `mutation Mutation($input: WatchlistInput!) {
            addToWatchlist(input: $input)
          }`,
        variables: {
          input: {
            userId: testMockWatchlistUser.id,
            itemId: testMockProfiles.id,
            itemType: defs.EntityType.Profile,
          },
        },
      })

      const edge = await repositories.edge.findOne({
        where: {
          thisEntityId: testMockWatchlistUser.id,
          thisEntityType: defs.EntityType.User,
          edgeType: defs.EdgeType.Watches,
          thatEntityId: testMockProfiles.id,
          thatEntityType: defs.EntityType.Profile,
        },
      })

      expect(edge?.id).not.toBeNull()
      expect(edge?.thisEntityId).toBe(testMockWatchlistUser.id)
      expect(edge?.thatEntityId).toBe(testMockProfiles.id)
      expect(result?.data?.addToWatchlist).toBe(true)
      expect(result?.errors).toBeUndefined()
    })

    it('should not add to watchlist', async () => {
      const result = await testServer.executeOperation({
        query: `mutation Mutation($input: WatchlistInput!) {
          addToWatchlist(input: $input)
        }`,
        variables: {
          input: {
            userId: null,
            itemId: testMockProfiles.id,
            itemType: defs.EntityType.Profile,
          },
        },
      })

      expect(result?.errors).toHaveLength(1)
    })
  })
})
