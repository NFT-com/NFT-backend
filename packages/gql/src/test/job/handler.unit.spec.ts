import {
  chainIdToCacheKeyProfile,
  chainIdToCacheKeyResolverAssociate,
  getCachedBlock,
} from '@nftcom/gql/job/handler'

jest.mock('@nftcom/gql/service/cache.service', () => ({
  cache: jest.fn(),
  createCacheConnection: jest.fn(),
}))

describe('handler', () => {
  describe('getCachedBlock', () => {
    it('should return default block number for goerli', async () => {
      const block = await getCachedBlock(5, 'resolver_associate_cached_block_5')
      expect(block).toEqual(7128515)
    })
  })

  describe('chainIdToCacheKeyProfile', () => {
    it('should return cache key for profile on goerli', async () => {
      const key = chainIdToCacheKeyProfile(5)
      expect(key).toEqual('minted_profile_cached_block_5')
    })
  })

  describe('chainIdToCacheKeyResolverAssociate', () => {
    it('should return cache key for resolver associate', async () => {
      const key = chainIdToCacheKeyResolverAssociate(5)
      expect(key).toEqual('resolver_associate_cached_block_5')
    })
  })
})
