import { Context } from '@nftcom/gql/defs'
import { default as collectionResolver } from '@nftcom/gql/resolver/collection.resolver'
import { fetchData } from '@nftcom/nftport-client'
import { Repository } from '@nftcom/shared/db/db'
import { NFTRepository } from '@nftcom/shared/db/repository'

jest.mock('@nftcom/cache', () => ({
  createCacheConnection: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
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

  fdescribe('getCollectionLeaderboard', () => {
    it('should sort collections with highest ranked leaders at the top', async () => {
      mockCtx.repositories = {
        collection: {
          findAllOfficial: jest.fn().mockResolvedValue([
            { contract: '0x0000' },
            { contract: '0x0001' },
            { contract: '0x0002' },
            { contract: '0x0003' },
            { contract: '0x0004' },
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

      expect(leaderboard).toEqual([
        { contract: '0x0004' },
        { contract: '0x0003' },
        { contract: '0x0002' },
        { contract: '0x0001' },
        { contract: '0x0000' },
      ])
    })
  })
})