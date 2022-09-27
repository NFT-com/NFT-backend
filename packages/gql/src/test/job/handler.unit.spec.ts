import { Job } from 'bull'

import { provider } from '@nftcom/gql/helper'
import {
  chainIdToCacheKeyProfile,
  chainIdToCacheKeyResolverAssociate,
  getCachedBlock, getEthereumEvents, getMintedProfileEvents, getResolverEvents,
} from '@nftcom/gql/job/handler'
import * as handler from '@nftcom/gql/job/handler'

jest.setTimeout(500000)

jest.mock('@nftcom/gql/service/cache.service', () => ({
  cache: jest.fn(),
  createCacheConnection: jest.fn(),
}))

const topics = [
  '0xfdbd996e3e72e8c7d34fc2f374c3c85c80a530bd1cdaa4a748d34e32103c5cc3',
]

const topicsA = [
  '0x3cfe0d1e57997f254288c17bcecea6e7d3dd16ab9ece2efe0cd4f37e1a7ac91d',
  '0x1c3b6e6efe3dd09f34c0294456587aacc0084bc4c3069b692382e1d02b07cae3',
  '0x5d9e0ecab6817bfc7492ca3b70191ffacf59a600ecb6814f5b036e17c85b4390',
  '0xabf787efbb4a8e7ac5d6bd79dd177a56b08a1dad80907dac3ddff8e953df3d2c',
  '0x8db6e7c90b4cd8a0d26047908cc0a5f0cb0f1a096f1a5093d9334c7225df1720',
]

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
      const address = '0x8db6e7c90b4cd8a0d26047908cc0a5f0cb0f1a096f1a5093d9334c7225df1720'
      const chainProvider = provider.provider(5)
      const result = await getResolverEvents([topicsA], 5, chainProvider, address)
      expect(result).toBeDefined()
      expect(result.logs.length).toEqual(0)
    })
  })

  describe('getMintedProfileEvents', () => {
    it('should return minted profile events', async () => {
      const address = '0x1338A9ec2Ef9906B57082dB0F67ED9E6E661F4A7'
      const chainProvider = provider.provider(5)
      const result = await getMintedProfileEvents([topics], 5, chainProvider, address)
      expect(result).toBeDefined()
      expect(result.logs.length).toEqual(0)
    })
  })

  describe('getEthereumEvents', () => {
    it('executes getEthereumEvents', async () => {
      const mintedProfileEventsSpy = jest.spyOn(handler, 'getMintedProfileEvents')
        .mockImplementation(
          () => Promise.resolve({
            logs: [],
            latestBlockNumber: 7128515,
          }),
        )
      const resolverEventsSpy = jest.spyOn(handler, 'getResolverEvents')
        .mockImplementation(
          () => Promise.resolve({
            logs: [],
            latestBlockNumber: 7128515,
          }),
        )

      await getEthereumEvents({ id: 'test-job-id', data: { chainId: '5' } } as Job)

      expect(mintedProfileEventsSpy).toHaveBeenCalled()
      expect(resolverEventsSpy).toHaveBeenCalled()
    })
  })
})
