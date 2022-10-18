import { Context } from '@nftcom/gql/defs'
import { default as collectionResolver } from '@nftcom/gql/resolver/collection.resolver'
import { Repository } from '@nftcom/shared/db/db'
import { NFTRepository } from '@nftcom/shared/db/repository'

jest.mock('@nftcom/gql/service/cache.service', () => ({
  createCacheConnection: jest.fn(),
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

      const traitSummary = await collectionResolver.Query.collectionTraits(undefined, { contract: '0x00000' }, mockCtx)

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
})