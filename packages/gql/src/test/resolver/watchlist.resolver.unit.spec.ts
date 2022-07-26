import { Connection } from 'typeorm'

import { testDBConfig } from '@nftcom/gql/config'
import { db, defs } from '@nftcom/shared'
import { Profile, User } from '@nftcom/shared/db/entity'

import { testMockProfiles, testMockWallet,testMockWatchlistUser } from '../util/constants'
import { getTestApolloServer } from '../util/testApolloServer'

jest.setTimeout(300000)

jest.mock('@nftcom/gql/service/cache.service', () => ({
  cache: jest.fn(),
  createCacheConnection: jest.fn(),
}))

let testServer
let connection: Connection

const repositories = db.newRepositories()

describe('watchlist resolver', () => {
  beforeAll(async () => {
    connection = await db.connectTestDB(testDBConfig)

    testServer = getTestApolloServer(
      repositories,
      testMockWatchlistUser,
      testMockWallet,
    )
  })

  afterAll(async () => {
    jest.clearAllMocks()
    await testServer.stop()

    if (!connection) return
    await connection.close()
  })

  describe('add to watchlist', () => {
    beforeAll(async () => {
      const user: User = testMockWatchlistUser as User
      const profile: Profile = testMockProfiles as Profile

      await Promise.all([repositories.user.save(user), repositories.profile.save(profile)])
    })

    afterAll(async () => {
      const edges = await repositories.edge.find({ where: { edgeType: defs.EdgeType.Watches } })
      const edgeIds = edges.map(edge => edge.id)
      await Promise.all([
        repositories.edge.hardDeleteByIds(edgeIds),
        repositories.user.hardDeleteByIds([testMockWatchlistUser.id]),
        repositories.profile.hardDeleteByIds([testMockProfiles.id]),
      ])
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

      const edge = await repositories.edge.findOne({ where: {
        thisEntityId: testMockWatchlistUser.id,
        thisEntityType: defs.EntityType.User,
        edgeType: defs.EdgeType.Watches,
        thatEntityId: testMockProfiles.id,
        thatEntityType: defs.EntityType.Profile,
      } })

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
