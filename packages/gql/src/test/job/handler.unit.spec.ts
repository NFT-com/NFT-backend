import { provider } from '@nftcom/gql/helper'
import {
  chainIdToCacheKeyProfile,
  chainIdToCacheKeyResolverAssociate,
  getCachedBlock, getResolverEvents,
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

  describe('getResolverEvents', () => {
    it('should return resolver events', async () => {
      const topics = [
        '0x3cfe0d1e57997f254288c17bcecea6e7d3dd16ab9ece2efe0cd4f37e1a7ac91d',
        '0x1c3b6e6efe3dd09f34c0294456587aacc0084bc4c3069b692382e1d02b07cae3',
        '0x5d9e0ecab6817bfc7492ca3b70191ffacf59a600ecb6814f5b036e17c85b4390',
        '0xabf787efbb4a8e7ac5d6bd79dd177a56b08a1dad80907dac3ddff8e953df3d2c',
        '0x8db6e7c90b4cd8a0d26047908cc0a5f0cb0f1a096f1a5093d9334c7225df1720',
      ]
      const address = '0x8db6e7c90b4cd8a0d26047908cc0a5f0cb0f1a096f1a5093d9334c7225df1720'
      const chainProvider = provider.provider(5)
      const result = await getResolverEvents([topics], 5, chainProvider, address)
      expect(result).toBeDefined()
      expect(result.logs.length).toEqual(0)
    })
  })
})
