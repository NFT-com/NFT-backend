import { Context } from '@nftcom/gql/defs'
import { default as collectionResolver } from '@nftcom/gql/resolver/collection.resolver'
import { fetchData } from '@nftcom/nftport-client'
import { Repository } from '@nftcom/shared/db/db'
import { NFTRepository } from '@nftcom/shared/db/repository'

jest.mock('@nftcom/cache', () => ({
  createCacheConnection: jest.fn(),
  cache: {
    get: jest.fn(),
    set: jest.fn(),
  },
}))
const mockFetchData = fetchData as jest.Mock

jest.mock('@nftcom/nftport-client', () => ({
  fetchData: jest.fn(),
}))

const mockCtx = {
  chain: undefined,
  network: undefined,
  repositories: undefined,
  user: undefined,
  wallet: undefined,
} as Context

describe('collection resolver', () => {
  describe('getCollectionTraits', () => {
    it('should summarize traits for a collection', async () => {
      mockCtx.repositories = {
        nft: {
          fetchTraitSummaryData: jest.fn().mockResolvedValue([
            { count: 100, type: 'A Trait', value: 'A' },
            { count: 99, type: 'A Trait', value: 'C' },
            { count: 98, type: 'A Trait', value: 'B' },
            { count: 101, type: 'Trait B', value: 'z' },
            { count: 99, type: 'Trait B', value: 'x' },
            { count: 97, type: 'Trait B', value: 'y' },
          ]),
        }  as unknown as NFTRepository,
      } as unknown as Repository

      const traitSummary = await collectionResolver.Query.collectionTraits(undefined, { input: { contract: '0x00000' } }, mockCtx)

      expect(traitSummary.stats.totalCount).toBe(297)
      expect(traitSummary.traits[0].type).toBe('A Trait')
      expect(traitSummary.traits[0].counts[0]).toEqual({ count: 100, value: 'A' })
      expect(traitSummary.traits[0].counts[1]).toEqual({ count: 99, value: 'C' })
      expect(traitSummary.traits[0].counts[2]).toEqual({ count: 98, value: 'B' })
      expect(traitSummary.traits[1].type).toBe('Trait B')
      expect(traitSummary.traits[1].counts[0]).toEqual({ count: 101, value: 'z' })
      expect(traitSummary.traits[1].counts[1]).toEqual({ count: 99, value: 'x' })
      expect(traitSummary.traits[1].counts[2]).toEqual({ count: 97, value: 'y' })
    })
  })

  describe('getCollectionLeaderboard', () => {
    beforeEach(() => {
      jest.resetAllMocks()
    })
    it('should sort collections with highest ranked leaders at the top', async () => {
      mockCtx.repositories = {
        collection: {
          findAllOfficial: jest.fn().mockResolvedValue([
            { id: '0', contract: '0x0000' },
            { id: '1', contract: '0x0001' },
            { id: '2', contract: '0x0002' },
            { id: '3', contract: '0x0003' },
            { id: '4', contract: '0x0004' },
          ]),
        }  as unknown as NFTRepository,
      } as unknown as Repository

      mockFetchData
        .mockResolvedValueOnce({ statistics: { seven_day_sales: 0 } })
        .mockResolvedValueOnce({ statistics: { seven_day_sales: 1 } })
        .mockResolvedValueOnce({ statistics: { seven_day_sales: 2 } })
        .mockResolvedValueOnce({ statistics: { seven_day_sales: 3 } })
        .mockResolvedValueOnce({ statistics: { seven_day_sales: 4 } })

      const leaderboard = await collectionResolver.Query.collectionLeaderboard(undefined, {}, mockCtx)

      console.log('LEADERBOARD', leaderboard)
      expect(leaderboard.items).toEqual([
        { id: '4', contract: '0x0004' },
        { id: '3', contract: '0x0003' },
        { id: '2', contract: '0x0002' },
        { id: '1', contract: '0x0001' },
        { id: '0', contract: '0x0000' },
      ])
      expect(leaderboard.totalItems).toEqual(5)
    })

    it('should sort collections when a collection does not have stats', async () => {
      mockCtx.repositories = {
        collection: {
          findAllOfficial: jest.fn().mockResolvedValue([
            { id: '0', contract: '0x0000' },
            { id: '1', contract: '0x0001' },
            { id: '2', contract: '0x0002' },
            { id: '3', contract: '0x0003' },
            { id: '4', contract: '0x0004' },
          ]),
        }  as unknown as NFTRepository,
      } as unknown as Repository

      mockFetchData
        .mockResolvedValueOnce({ statistics: { seven_day_sales: 0 } })
        .mockResolvedValueOnce({ statistics: { seven_day_sales: 1 } })
        .mockResolvedValueOnce({ })
        .mockResolvedValueOnce({ statistics: { seven_day_sales: 3 } })
        .mockResolvedValueOnce({ statistics: { seven_day_sales: 4 } })

      const leaderboard = await collectionResolver.Query.collectionLeaderboard(undefined, {}, mockCtx)

      expect(leaderboard.items).toEqual([
        { id: '4', contract: '0x0004' },
        { id: '3', contract: '0x0003' },
        { id: '1', contract: '0x0001' },
        { id: '0', contract: '0x0000' },
        { id: '2', contract: '0x0002' },
      ])
      expect(leaderboard.totalItems).toEqual(5)
    })

    it('should sort collections falling back to persisted stats when needed', async () => {
      mockCtx.repositories = {
        collection: {
          findAllOfficial: jest.fn().mockResolvedValue([
            { id: '0', contract: '0x0000', totalVolume: 90 },
            { id: '1', contract: '0x0001' },
            { id: '2', contract: '0x0002', totalVolume: 100 },
            { id: '3', contract: '0x0003' },
            { id: '4', contract: '0x0004' },
          ]),
        }  as unknown as NFTRepository,
      } as unknown as Repository

      mockFetchData
        .mockImplementationOnce(() => { throw new Error() })
        .mockResolvedValueOnce({ statistics: { seven_day_sales: 1 } })
        .mockImplementationOnce(() => { throw new Error() })
        .mockResolvedValueOnce({ statistics: { seven_day_sales: 3 } })
        .mockResolvedValueOnce({ statistics: { seven_day_sales: 4 } })

      const leaderboard = await collectionResolver.Query.collectionLeaderboard(undefined, {}, mockCtx)
      const leaderboardItems = leaderboard.items.map(({ totalVolume, ...rest }) => rest)

      expect(leaderboardItems).toEqual([
        { id: '4', contract: '0x0004' },
        { id: '3', contract: '0x0003' },
        { id: '1', contract: '0x0001' },
        { id: '2', contract: '0x0002' },
        { id: '0', contract: '0x0000' },
      ])
      expect(leaderboard.totalItems).toEqual(5)
    })

    it('should paginate the top 20 by default', async () => {
      mockCtx.repositories = {
        collection: {
          findAllOfficial: jest.fn().mockResolvedValue([
            { id: '0', contract: '0x0000' },
            { id: '1', contract: '0x0001' },
            { id: '2', contract: '0x0002' },
            { id: '3', contract: '0x0003' },
            { id: '4', contract: '0x0004' },
            { id: '5', contract: '0x0005' },
            { id: '6', contract: '0x0006' },
            { id: '7', contract: '0x0007' },
            { id: '8', contract: '0x0008' },
            { id: '9', contract: '0x0009' },
            { id: '10', contract: '0x0010' },
            { id: '11', contract: '0x0011' },
            { id: '12', contract: '0x0012' },
            { id: '13', contract: '0x0013' },
            { id: '14', contract: '0x0014' },
            { id: '15', contract: '0x0015' },
            { id: '16', contract: '0x0016' },
            { id: '17', contract: '0x0017' },
            { id: '18', contract: '0x0018' },
            { id: '19', contract: '0x0019' },
            { id: '20', contract: '0x0020' },
          ]),
        }  as unknown as NFTRepository,
      } as unknown as Repository

      let sales = 0
      mockFetchData
        .mockImplementation(() => {
          return { statistics: { seven_day_sales: sales++ } }
        })

      const leaderboard = await collectionResolver.Query.collectionLeaderboard(undefined, {}, mockCtx)

      expect(leaderboard.items).toEqual([
        { id: '20', contract: '0x0020' },
        { id: '19', contract: '0x0019' },
        { id: '18', contract: '0x0018' },
        { id: '17', contract: '0x0017' },
        { id: '16', contract: '0x0016' },
        { id: '15', contract: '0x0015' },
        { id: '14', contract: '0x0014' },
        { id: '13', contract: '0x0013' },
        { id: '12', contract: '0x0012' },
        { id: '11', contract: '0x0011' },
        { id: '10', contract: '0x0010' },
        { id: '9', contract: '0x0009' },
        { id: '8', contract: '0x0008' },
        { id: '7', contract: '0x0007' },
        { id: '6', contract: '0x0006' },
        { id: '5', contract: '0x0005' },
        { id: '4', contract: '0x0004' },
        { id: '3', contract: '0x0003' },
        { id: '2', contract: '0x0002' },
        { id: '1', contract: '0x0001' },
      ])
      expect(leaderboard.totalItems).toEqual(21)
      expect(leaderboard.pageInfo).toEqual({
        firstCursor: '20',
        lastCursor: '1',
      })
    })

    it('should paginate to the next page', async () => {
      mockCtx.repositories = {
        collection: {
          findAllOfficial: jest.fn().mockResolvedValue([
            { id: '0', contract: '0x0000' },
            { id: '1', contract: '0x0001' },
            { id: '2', contract: '0x0002' },
            { id: '3', contract: '0x0003' },
            { id: '4', contract: '0x0004' },
            { id: '5', contract: '0x0005' },
            { id: '6', contract: '0x0006' },
            { id: '7', contract: '0x0007' },
            { id: '8', contract: '0x0008' },
            { id: '9', contract: '0x0009' },
            { id: '10', contract: '0x0010' },
            { id: '11', contract: '0x0011' },
            { id: '12', contract: '0x0012' },
            { id: '13', contract: '0x0013' },
            { id: '14', contract: '0x0014' },
            { id: '15', contract: '0x0015' },
            { id: '16', contract: '0x0016' },
            { id: '17', contract: '0x0017' },
            { id: '18', contract: '0x0018' },
            { id: '19', contract: '0x0019' },
            { id: '20', contract: '0x0020' },
          ]),
        }  as unknown as NFTRepository,
      } as unknown as Repository

      let sales = 0
      mockFetchData
        .mockImplementation(() => {
          return { statistics: { seven_day_sales: sales++ } }
        })

      const leaderboard = (await collectionResolver
        .Query
        .collectionLeaderboard(undefined, { input: { pageInput: { afterCursor: '1' } } }, mockCtx))

      expect(leaderboard.items).toEqual([
        { id: '0', contract: '0x0000' },
      ])
      expect(leaderboard.totalItems).toEqual(21)
      expect(leaderboard.pageInfo).toEqual({
        firstCursor: '0',
        lastCursor: '0',
      })
    })

    it('should paginate to before', async () => {
      mockCtx.repositories = {
        collection: {
          findAllOfficial: jest.fn().mockResolvedValue([
            { id: '0', contract: '0x0000' },
            { id: '1', contract: '0x0001' },
            { id: '2', contract: '0x0002' },
            { id: '3', contract: '0x0003' },
            { id: '4', contract: '0x0004' },
            { id: '5', contract: '0x0005' },
            { id: '6', contract: '0x0006' },
            { id: '7', contract: '0x0007' },
            { id: '8', contract: '0x0008' },
            { id: '9', contract: '0x0009' },
            { id: '10', contract: '0x0010' },
            { id: '11', contract: '0x0011' },
            { id: '12', contract: '0x0012' },
            { id: '13', contract: '0x0013' },
            { id: '14', contract: '0x0014' },
            { id: '15', contract: '0x0015' },
            { id: '16', contract: '0x0016' },
            { id: '17', contract: '0x0017' },
            { id: '18', contract: '0x0018' },
            { id: '19', contract: '0x0019' },
            { id: '20', contract: '0x0020' },
          ]),
        }  as unknown as NFTRepository,
      } as unknown as Repository

      let sales = 0
      mockFetchData
        .mockImplementation(() => {
          return { statistics: { seven_day_sales: sales++ } }
        })

      const leaderboard = (await collectionResolver
        .Query
        .collectionLeaderboard(undefined, { input: { pageInput: { beforeCursor: '10' } } }, mockCtx))

      expect(leaderboard.items).toEqual([
        { id: '20', contract: '0x0020' },
        { id: '19', contract: '0x0019' },
        { id: '18', contract: '0x0018' },
        { id: '17', contract: '0x0017' },
        { id: '16', contract: '0x0016' },
        { id: '15', contract: '0x0015' },
        { id: '14', contract: '0x0014' },
        { id: '13', contract: '0x0013' },
        { id: '12', contract: '0x0012' },
        { id: '11', contract: '0x0011' },
      ])
      expect(leaderboard.totalItems).toEqual(21)
      expect(leaderboard.pageInfo).toEqual({
        firstCursor: '20',
        lastCursor: '11',
      })
    })

    it('should paginate first before', async () => {
      mockCtx.repositories = {
        collection: {
          findAllOfficial: jest.fn().mockResolvedValue([
            { id: '0', contract: '0x0000' },
            { id: '1', contract: '0x0001' },
            { id: '2', contract: '0x0002' },
            { id: '3', contract: '0x0003' },
            { id: '4', contract: '0x0004' },
            { id: '5', contract: '0x0005' },
            { id: '6', contract: '0x0006' },
            { id: '7', contract: '0x0007' },
            { id: '8', contract: '0x0008' },
            { id: '9', contract: '0x0009' },
            { id: '10', contract: '0x0010' },
            { id: '11', contract: '0x0011' },
            { id: '12', contract: '0x0012' },
            { id: '13', contract: '0x0013' },
            { id: '14', contract: '0x0014' },
            { id: '15', contract: '0x0015' },
            { id: '16', contract: '0x0016' },
            { id: '17', contract: '0x0017' },
            { id: '18', contract: '0x0018' },
            { id: '19', contract: '0x0019' },
            { id: '20', contract: '0x0020' },
          ]),
        }  as unknown as NFTRepository,
      } as unknown as Repository

      let sales = 0
      mockFetchData
        .mockImplementation(() => {
          return { statistics: { seven_day_sales: sales++ } }
        })

      const leaderboard = (await collectionResolver
        .Query
        .collectionLeaderboard(undefined, { input: { pageInput: { first: 5, beforeCursor: '10' } } }, mockCtx))

      expect(leaderboard.items).toEqual([
        { id: '20', contract: '0x0020' },
        { id: '19', contract: '0x0019' },
        { id: '18', contract: '0x0018' },
        { id: '17', contract: '0x0017' },
        { id: '16', contract: '0x0016' },
      ])
      expect(leaderboard.totalItems).toEqual(21)
      expect(leaderboard.pageInfo).toEqual({
        firstCursor: '20',
        lastCursor: '16',
      })
    })

    it('should paginate last before', async () => {
      mockCtx.repositories = {
        collection: {
          findAllOfficial: jest.fn().mockResolvedValue([
            { id: '0', contract: '0x0000' },
            { id: '1', contract: '0x0001' },
            { id: '2', contract: '0x0002' },
            { id: '3', contract: '0x0003' },
            { id: '4', contract: '0x0004' },
            { id: '5', contract: '0x0005' },
            { id: '6', contract: '0x0006' },
            { id: '7', contract: '0x0007' },
            { id: '8', contract: '0x0008' },
            { id: '9', contract: '0x0009' },
            { id: '10', contract: '0x0010' },
            { id: '11', contract: '0x0011' },
            { id: '12', contract: '0x0012' },
            { id: '13', contract: '0x0013' },
            { id: '14', contract: '0x0014' },
            { id: '15', contract: '0x0015' },
            { id: '16', contract: '0x0016' },
            { id: '17', contract: '0x0017' },
            { id: '18', contract: '0x0018' },
            { id: '19', contract: '0x0019' },
            { id: '20', contract: '0x0020' },
          ]),
        }  as unknown as NFTRepository,
      } as unknown as Repository

      let sales = 0
      mockFetchData
        .mockImplementation(() => {
          return { statistics: { seven_day_sales: sales++ } }
        })

      const leaderboard = (await collectionResolver
        .Query
        .collectionLeaderboard(undefined, { input: { pageInput: { last: 4, beforeCursor: '5' } } }, mockCtx))

      expect(leaderboard.items).toEqual([
        { id: '9', contract: '0x0009' },
        { id: '8', contract: '0x0008' },
        { id: '7', contract: '0x0007' },
        { id: '6', contract: '0x0006' },
      ])
      expect(leaderboard.totalItems).toEqual(21)
      expect(leaderboard.pageInfo).toEqual({
        firstCursor: '9',
        lastCursor: '6',
      })
    })

    it('should paginate last after', async () => {
      mockCtx.repositories = {
        collection: {
          findAllOfficial: jest.fn().mockResolvedValue([
            { id: '0', contract: '0x0000' },
            { id: '1', contract: '0x0001' },
            { id: '2', contract: '0x0002' },
            { id: '3', contract: '0x0003' },
            { id: '4', contract: '0x0004' },
            { id: '5', contract: '0x0005' },
            { id: '6', contract: '0x0006' },
            { id: '7', contract: '0x0007' },
            { id: '8', contract: '0x0008' },
            { id: '9', contract: '0x0009' },
            { id: '10', contract: '0x0010' },
            { id: '11', contract: '0x0011' },
            { id: '12', contract: '0x0012' },
            { id: '13', contract: '0x0013' },
            { id: '14', contract: '0x0014' },
            { id: '15', contract: '0x0015' },
            { id: '16', contract: '0x0016' },
            { id: '17', contract: '0x0017' },
            { id: '18', contract: '0x0018' },
            { id: '19', contract: '0x0019' },
            { id: '20', contract: '0x0020' },
          ]),
        }  as unknown as NFTRepository,
      } as unknown as Repository

      let sales = 0
      mockFetchData
        .mockImplementation(() => {
          return { statistics: { seven_day_sales: sales++ } }
        })

      const leaderboard = (await collectionResolver
        .Query
        .collectionLeaderboard(undefined, { input: { pageInput: { last: 7, afterCursor: '18' } } }, mockCtx))

      expect(leaderboard.items).toEqual([
        { id: '6', contract: '0x0006' },
        { id: '5', contract: '0x0005' },
        { id: '4', contract: '0x0004' },
        { id: '3', contract: '0x0003' },
        { id: '2', contract: '0x0002' },
        { id: '1', contract: '0x0001' },
        { id: '0', contract: '0x0000' },
      ])
      expect(leaderboard.totalItems).toEqual(21)
      expect(leaderboard.pageInfo).toEqual({
        firstCursor: '6',
        lastCursor: '0',
      })
    })

    it('should paginate last after and return remaining items if less than last', async () => {
      mockCtx.repositories = {
        collection: {
          findAllOfficial: jest.fn().mockResolvedValue([
            { id: '0', contract: '0x0000' },
            { id: '1', contract: '0x0001' },
            { id: '2', contract: '0x0002' },
            { id: '3', contract: '0x0003' },
            { id: '4', contract: '0x0004' },
            { id: '5', contract: '0x0005' },
            { id: '6', contract: '0x0006' },
            { id: '7', contract: '0x0007' },
            { id: '8', contract: '0x0008' },
            { id: '9', contract: '0x0009' },
            { id: '10', contract: '0x0010' },
            { id: '11', contract: '0x0011' },
            { id: '12', contract: '0x0012' },
            { id: '13', contract: '0x0013' },
            { id: '14', contract: '0x0014' },
            { id: '15', contract: '0x0015' },
            { id: '16', contract: '0x0016' },
            { id: '17', contract: '0x0017' },
            { id: '18', contract: '0x0018' },
            { id: '19', contract: '0x0019' },
            { id: '20', contract: '0x0020' },
          ]),
        }  as unknown as NFTRepository,
      } as unknown as Repository

      let sales = 0
      mockFetchData
        .mockImplementation(() => {
          return { statistics: { seven_day_sales: sales++ } }
        })

      const leaderboard = (await collectionResolver
        .Query
        .collectionLeaderboard(undefined, { input: { pageInput: { last: 7, afterCursor: '5' } } }, mockCtx))

      expect(leaderboard.items).toEqual([
        { id: '4', contract: '0x0004' },
        { id: '3', contract: '0x0003' },
        { id: '2', contract: '0x0002' },
        { id: '1', contract: '0x0001' },
        { id: '0', contract: '0x0000' },
      ])
      expect(leaderboard.totalItems).toEqual(21)
      expect(leaderboard.pageInfo).toEqual({
        firstCursor: '4',
        lastCursor: '0',
      })
    })
  })
})