import { fetchData } from '@nftcom/nftport-client'
import { entity } from '@nftcom/shared'
import { CollectionRepository } from '@nftcom/shared/db/repository'

import { hydrateCollectionLeaderboard,updateCollectionLeaderboard } from './collection-leaderboard'

let mockCacheData = {}
jest.mock('@nftcom/cache', () => ({
  createCacheConnection: jest.fn(),
  cache: {
    get: jest.fn(),
    set: jest.fn(),
    zadd: async (...args) => {
      const [key, score, data, ..._rest] = args
      Object.hasOwn(mockCacheData, key) ?
        mockCacheData[key].push({ score, data }) :
        mockCacheData[key] = [{ score, data }]
    },
    zrange: async (...args) => {
      const [key, ..._rest] = args
      return mockCacheData[key] ?
        mockCacheData[key].sort((a, b) => {
          return b.score - a.score
        }).map((v) => v.data) :
        undefined
    },
  },
}))

const mockFetchData = fetchData as jest.Mock
jest.mock('@nftcom/nftport-client', () => ({
  fetchData: jest.fn(),
}))

describe('leaderboard', () => {
  describe('updateCollectionLeaderboard', () => {
    beforeEach(() => {
      mockCacheData = {}
      jest.resetAllMocks()
    })
    it('should sort collections with highest ranked leaders at the top', async () => {
      const collectionRepo = {
        findAllOfficial: jest.fn().mockResolvedValue([
          { id: '0', contract: '0x0000' },
          { id: '1', contract: '0x0001' },
          { id: '2', contract: '0x0002' },
          { id: '3', contract: '0x0003' },
          { id: '4', contract: '0x0004' },
        ]),
      }  as unknown as CollectionRepository

      mockFetchData
        .mockResolvedValueOnce({ statistics: { seven_day_sales: 0 } })
        .mockResolvedValueOnce({ statistics: { seven_day_sales: 1 } })
        .mockResolvedValueOnce({ statistics: { seven_day_sales: 2 } })
        .mockResolvedValueOnce({ statistics: { seven_day_sales: 3 } })
        .mockResolvedValueOnce({ statistics: { seven_day_sales: 4 } })

      const leaderboard = await updateCollectionLeaderboard(collectionRepo, 'COLLECTION_LEADERBOARD_7d')

      expect(leaderboard).toEqual([
        { id: '4', contract: '0x0004', stats: { seven_day_sales: 4 } },
        { id: '3', contract: '0x0003', stats: { seven_day_sales: 3 } },
        { id: '2', contract: '0x0002', stats: { seven_day_sales: 2 } },
        { id: '1', contract: '0x0001', stats: { seven_day_sales: 1 } },
        { id: '0', contract: '0x0000', stats: { seven_day_sales: 0 } },
      ])
    })

    it('should sort collections when a collection does not have stats', async () => {
      const collectionRepo = {
        findAllOfficial: jest.fn().mockResolvedValue([
          { id: '0', contract: '0x0000' },
          { id: '1', contract: '0x0001' },
          { id: '2', contract: '0x0002' },
          { id: '3', contract: '0x0003' },
          { id: '4', contract: '0x0004' },
        ]),
      }  as unknown as CollectionRepository

      mockFetchData
        .mockResolvedValueOnce({ statistics: { seven_day_sales: 0 } })
        .mockResolvedValueOnce({ statistics: { seven_day_sales: 1 } })
        .mockResolvedValueOnce({ })
        .mockResolvedValueOnce({ statistics: { seven_day_sales: 3 } })
        .mockResolvedValueOnce({ statistics: { seven_day_sales: 4 } })

      const leaderboard = await updateCollectionLeaderboard(collectionRepo, 'COLLECTION_LEADERBOARD_7d')

      expect(leaderboard).toEqual([
        { id: '4', contract: '0x0004', stats: { seven_day_sales: 4 } },
        { id: '3', contract: '0x0003', stats: { seven_day_sales: 3 } },
        { id: '1', contract: '0x0001', stats: { seven_day_sales: 1 } },
        { id: '0', contract: '0x0000', stats: { seven_day_sales: 0 } },
        { id: '2', contract: '0x0002' },
      ])
    })

    it('should sort collections falling back to persisted stats when needed', async () => {
      const collectionRepo = {
        findAllOfficial: jest.fn().mockResolvedValue([
          { id: '0', contract: '0x0000', totalVolume: 90 },
          { id: '1', contract: '0x0001' },
          { id: '2', contract: '0x0002', totalVolume: 100 },
          { id: '3', contract: '0x0003' },
          { id: '4', contract: '0x0004' },
        ]),
      }  as unknown as CollectionRepository

      mockFetchData
        .mockImplementationOnce(() => { throw new Error() })
        .mockResolvedValueOnce({ statistics: { seven_day_sales: 1 } })
        .mockImplementationOnce(() => { throw new Error() })
        .mockResolvedValueOnce({ statistics: { seven_day_sales: 3 } })
        .mockResolvedValueOnce({ statistics: { seven_day_sales: 4 } })

      const leaderboard = await updateCollectionLeaderboard(collectionRepo, 'COLLECTION_LEADERBOARD_7d')
      const leaderboardItems = leaderboard.map(({ totalVolume, ...rest }) => rest)

      expect(leaderboardItems).toEqual([
        { id: '4', contract: '0x0004', stats: { seven_day_sales: 4 } },
        { id: '3', contract: '0x0003', stats: { seven_day_sales: 3 } },
        { id: '1', contract: '0x0001', stats: { seven_day_sales: 1 } },
        { id: '2', contract: '0x0002' },
        { id: '0', contract: '0x0000' },
      ])
    })

    it('should sort collections with different stats available', async () => {
      const collectionRepo = {
        findAllOfficial: jest.fn().mockResolvedValue([
          { id: '0', contract: '0x0000' },
          { id: '1', contract: '0x0001' },
          { id: '2', contract: '0x0002' },
          { id: '3', contract: '0x0003' },
          { id: '4', contract: '0x0004' },
          { id: '5', contract: '0x0005' },
        ]),
      }  as unknown as CollectionRepository

      mockFetchData
        .mockResolvedValueOnce({ statistics: { seven_day_sales: 1 } })
        .mockResolvedValueOnce({ statistics: { seven_day_sales: Number.MAX_SAFE_INTEGER } })
        .mockResolvedValueOnce({ statistics: { seven_day_volume: 1 } })
        .mockResolvedValueOnce({ statistics: { seven_day_volume: Number.MAX_SAFE_INTEGER } })
        .mockResolvedValueOnce({ statistics: { total_volume: 1 } })
        .mockResolvedValueOnce({ statistics: { total_volume: Number.MAX_SAFE_INTEGER } })

      const leaderboard = await updateCollectionLeaderboard(collectionRepo, 'COLLECTION_LEADERBOARD_7d')

      expect(leaderboard).toEqual([
        { id: '1', contract: '0x0001', stats: { seven_day_sales: Number.MAX_SAFE_INTEGER } },
        { id: '0', contract: '0x0000', stats: { seven_day_sales: 1 } },
        { id: '3', contract: '0x0003', stats: { seven_day_volume: Number.MAX_SAFE_INTEGER } },
        { id: '2', contract: '0x0002', stats: { seven_day_volume: 1 } },
        { id: '5', contract: '0x0005', stats: { total_volume: Number.MAX_SAFE_INTEGER } },
        { id: '4', contract: '0x0004', stats: { total_volume: 1 } },
      ])
    })

    it('should sort collections with all stats available', async () => {
      const collectionRepo = {
        findAllOfficial: jest.fn().mockResolvedValue([
          { id: '0', contract: '0x0000' },
          { id: '1', contract: '0x0001' },
          { id: '2', contract: '0x0002' },
        ]),
      }  as unknown as CollectionRepository

      mockFetchData
        .mockResolvedValueOnce({ statistics: { seven_day_sales: 1, seven_day_volume: 1, total_volume: 1 } })
        .mockResolvedValueOnce({ statistics: {
          seven_day_sales: Number.MAX_SAFE_INTEGER, seven_day_volume: 1, total_volume: 1,
        } })
        .mockResolvedValueOnce({ statistics: {
          seven_day_sales: 1, seven_day_volume: Number.MAX_SAFE_INTEGER, total_volume: Number.MAX_SAFE_INTEGER,
        } })

      const leaderboard = await updateCollectionLeaderboard(collectionRepo, 'COLLECTION_LEADERBOARD_7d')

      expect(leaderboard).toEqual([
        { id: '1', contract: '0x0001', stats: {
          seven_day_sales: Number.MAX_SAFE_INTEGER, seven_day_volume: 1, total_volume: 1,
        } },
        { id: '2', contract: '0x0002', stats: {
          seven_day_sales: 1, seven_day_volume: Number.MAX_SAFE_INTEGER, total_volume: Number.MAX_SAFE_INTEGER,
        } },
        { id: '0', contract: '0x0000', stats: { seven_day_sales: 1, seven_day_volume: 1, total_volume: 1 } },
      ])
    })

    it('should sort collections when stats near', async () => {
      const collectionRepo = {
        findAllOfficial: jest.fn().mockResolvedValue([
          { id: '0', contract: '0x0000' },
          { id: '1', contract: '0x0001' },
          { id: '2', contract: '0x0002' },
        ]),
      }  as unknown as CollectionRepository

      mockFetchData
        .mockResolvedValueOnce({ statistics: { seven_day_sales: 1, seven_day_volume: 2, total_volume: 3 } })
        .mockResolvedValueOnce({ statistics: { seven_day_sales: 3, seven_day_volume: 2, total_volume: 1 } })
        .mockResolvedValueOnce({ statistics: { seven_day_sales: 2, seven_day_volume: 3, total_volume: 2 } })

      const leaderboard = await updateCollectionLeaderboard(collectionRepo, 'COLLECTION_LEADERBOARD_7d')

      expect(leaderboard).toEqual([
        { id: '1', contract: '0x0001', stats: { seven_day_sales: 3, seven_day_volume: 2, total_volume: 1 } },
        { id: '2', contract: '0x0002', stats: { seven_day_sales: 2, seven_day_volume: 3, total_volume: 2 } },
        { id: '0', contract: '0x0000', stats: { seven_day_sales: 1, seven_day_volume: 2, total_volume: 3 } },
      ])
    })
  })

  describe('hydrateCollectionLeaderboard', () => {
    it('should hydrate given an existing collections array', async () => {
      const hydratedCollections = await hydrateCollectionLeaderboard(
        ['0x0000', '0x0001'],
        { existingCollections: [
          { id: '0', contract: '0x0000', stats: { seven_day_sales: 2, seven_day_volume: 2, total_volume: 2 } },
          { id: '1', contract: '0x0001', stats: { seven_day_sales: 1, seven_day_volume: 1, total_volume: 1 } },
        ] as (entity.Collection & {stats?: any})[] },
      )

      expect(hydratedCollections).toEqual([
        { id: '0', contract: '0x0000', stats: { seven_day_sales: 2, seven_day_volume: 2, total_volume: 2 } },
        { id: '1', contract: '0x0001', stats: { seven_day_sales: 1, seven_day_volume: 1, total_volume: 1 } },
      ])
    })

    it('should hydrate by fetching collections', async () => {
      const collectionRepo = {
        findAllOfficial: jest.fn().mockResolvedValue([
          { id: '0', contract: '0x0000' },
          { id: '1', contract: '0x0001' },
          { id: '2', contract: '0x0002' },
        ]),
      }  as unknown as CollectionRepository

      mockFetchData
        .mockResolvedValueOnce({ statistics: { seven_day_sales: 0, seven_day_volume: 0, total_volume: 0 } })
        .mockResolvedValueOnce({ statistics: { seven_day_sales: 1, seven_day_volume: 1, total_volume: 1 } })
        .mockResolvedValueOnce({ statistics: { seven_day_sales: 2, seven_day_volume: 2, total_volume: 2 } })

      const hydratedCollections = await hydrateCollectionLeaderboard(
        ['0x0002', '0x0001'],
        { collectionRepo },
      )

      expect(hydratedCollections).toEqual([
        { id: '2', contract: '0x0002', stats: { seven_day_sales: 2, seven_day_volume: 2, total_volume: 2 } },
        { id: '1', contract: '0x0001', stats: { seven_day_sales: 1, seven_day_volume: 1, total_volume: 1 } },
      ])
    })
  })
})
