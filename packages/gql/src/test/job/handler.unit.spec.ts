import { Job } from 'bull'
import { DeepPartial } from 'typeorm'

import { provider } from '@nftcom/misc'
import {
  chainIdToCacheKeyProfile,
  chainIdToCacheKeyResolverAssociate,
  getCachedBlock,
  getEthereumEvents,
  getMintedProfileEvents,
  getResolverEvents,
  repositories,
} from '@nftcom/gql/job/handler'
import * as handler from '@nftcom/gql/job/handler'
import { entity } from '@nftcom/shared'

jest.setTimeout(500000)

jest.mock('@nftcom/cache', () => ({
  redisConfig: {},
  cache: {
    get: jest.fn().mockImplementation((key: string) => {
      if (key === 'resolver_associate_cached_block_mock') {
        return 20000000
      }
      return undefined
    }),
    set: jest.fn(),
  },
  createCacheConnection: jest.fn(),
}))

const topics = ['0xfdbd996e3e72e8c7d34fc2f374c3c85c80a530bd1cdaa4a748d34e32103c5cc3']

const topicsA = [
  '0x3cfe0d1e57997f254288c17bcecea6e7d3dd16ab9ece2efe0cd4f37e1a7ac91d',
  '0x1c3b6e6efe3dd09f34c0294456587aacc0084bc4c3069b692382e1d02b07cae3',
  '0x5d9e0ecab6817bfc7492ca3b70191ffacf59a600ecb6814f5b036e17c85b4390',
  '0xabf787efbb4a8e7ac5d6bd79dd177a56b08a1dad80907dac3ddff8e953df3d2c',
  '0x8db6e7c90b4cd8a0d26047908cc0a5f0cb0f1a096f1a5093d9334c7225df1720',
]

let mintedProfileEventsSpy
let resolverEventsSpy
let findOneEventSpy
let saveEventSpy

const checkSpies = (parseLogSpy: any): void => {
  expect(mintedProfileEventsSpy).toHaveBeenCalled()
  expect(resolverEventsSpy).toHaveBeenCalled()
  expect(parseLogSpy).toHaveBeenCalled()
  expect(findOneEventSpy).toHaveBeenCalled()
  expect(saveEventSpy).toHaveBeenCalled()
}

describe('handler', () => {
  describe('getCachedBlock', () => {
    it('should return default block number for goerli', async () => {
      const block = await getCachedBlock(5, 'resolver_associate_cached_block_5')
      expect(block).toEqual(7128515)
    })

    it('should return default block number for mainnet', async () => {
      const block = await getCachedBlock(1, 'resolver_associate_cached_block_1')
      expect(block).toEqual(14675454)
    })

    it('should return cached block number', async () => {
      const block = await getCachedBlock(1, 'resolver_associate_cached_block_mock')
      expect(block).toEqual(19999000)
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
    beforeAll(() => {
      mintedProfileEventsSpy = jest.spyOn(handler, 'getMintedProfileEvents').mockImplementation(() =>
        Promise.resolve({
          logs: [
            {
              blockNumber: 7128515,
              blockHash: 'test-block-hash',
              transactionIndex: 0,
              removed: false,
              address: 'test-address',
              data: 'test-data',
              topics,
              transactionHash: '0x62fe7e81f3c869093f8357472597d7aac0fa2d5b49a79a42c9633850d832c967',
              logIndex: 0,
            },
          ],
          latestBlockNumber: 8128515,
        }),
      )
      resolverEventsSpy = jest.spyOn(handler, 'getResolverEvents').mockImplementation(() =>
        Promise.resolve({
          logs: [
            {
              blockNumber: 7128515,
              blockHash: 'test-block-hash',
              transactionIndex: 0,
              removed: false,
              address: 'test-address',
              data: 'test-data',
              topics: topicsA,
              transactionHash: '0x62fe7e81f3c869093f8357472597d7aac0fa2d5b49a79a42c9633850d832c967',
              logIndex: 0,
            },
          ],
          latestBlockNumber: 8128515,
        }),
      )

      findOneEventSpy = jest.spyOn(repositories.event, 'findOne').mockImplementation(() => Promise.resolve(undefined))

      saveEventSpy = jest
        .spyOn(repositories.event, 'save')
        .mockImplementation((event: DeepPartial<entity.Event>) => Promise.resolve({ ...(event as any) }))
    })

    it('save event for AssociateEvmUser', async () => {
      const parseLogSpy = jest.spyOn(handler, 'nftResolverParseLog').mockImplementation(() => {
        return {
          eventFragment: null,
          name: 'AssociateEvmUser',
          signature: 'test-signature',
          topic: 'test-topic',
          args: ['0xBD3Feab37Eb7533B03bf77381D699aD8bA64A30B', 'goerli', '0x78D1795681A4D914a3600a041063E5E42cc557f1'],
        }
      })

      await getEthereumEvents({ id: 'test-job-id', data: { chainId: '5' } } as Job)
      checkSpies(parseLogSpy)
    })

    it('save event for CancelledEvmAssociation', async () => {
      const parseLogSpy = jest.spyOn(handler, 'nftResolverParseLog').mockImplementation(() => {
        return {
          eventFragment: null,
          name: 'CancelledEvmAssociation',
          signature: 'test-signature',
          topic: 'test-topic',
          args: ['0xBD3Feab37Eb7533B03bf77381D699aD8bA64A30B', 'goerli', '0x78D1795681A4D914a3600a041063E5E42cc557f1'],
        }
      })

      await getEthereumEvents({ id: 'test-job-id', data: { chainId: '5' } } as Job)
      checkSpies(parseLogSpy)
    })

    it('save event for ClearAllAssociatedAddresses', async () => {
      const parseLogSpy = jest.spyOn(handler, 'nftResolverParseLog').mockImplementation(() => {
        return {
          eventFragment: null,
          name: 'ClearAllAssociatedAddresses',
          signature: 'test-signature',
          topic: 'test-topic',
          args: ['0xBD3Feab37Eb7533B03bf77381D699aD8bA64A30B', 'goerli', '0x78D1795681A4D914a3600a041063E5E42cc557f1'],
        }
      })

      await getEthereumEvents({ id: 'test-job-id', data: { chainId: '5' } } as Job)
      checkSpies(parseLogSpy)
    })

    it('save event for AssociateSelfWithUser', async () => {
      const parseLogSpy = jest.spyOn(handler, 'nftResolverParseLog').mockImplementation(() => {
        return {
          eventFragment: null,
          name: 'AssociateSelfWithUser',
          signature: 'test-signature',
          topic: 'test-topic',
          args: ['0xBD3Feab37Eb7533B03bf77381D699aD8bA64A30B', 'goerli', '0x78D1795681A4D914a3600a041063E5E42cc557f1'],
        }
      })

      await getEthereumEvents({ id: 'test-job-id', data: { chainId: '5' } } as Job)
      checkSpies(parseLogSpy)
    })

    it('save event for SetAssociatedContract', async () => {
      const parseLogSpy = jest.spyOn(handler, 'nftResolverParseLog').mockImplementation(() => {
        return {
          eventFragment: null,
          name: 'SetAssociatedContract',
          signature: 'test-signature',
          topic: 'test-topic',
          args: ['0xBD3Feab37Eb7533B03bf77381D699aD8bA64A30B', 'goerli', '0x78D1795681A4D914a3600a041063E5E42cc557f1'],
        }
      })

      await getEthereumEvents({ id: 'test-job-id', data: { chainId: '5' } } as Job)
      checkSpies(parseLogSpy)
    })

    it.only('save event for MintedProfile', async () => {
      const parseLogSpy = jest.spyOn(handler, 'profileAuctionParseLog').mockImplementation(() => {
        return {
          eventFragment: null,
          name: 'MintedProfile',
          signature: 'test-signature',
          topic: 'test-topic',
          args: ['0xBD3Feab37Eb7533B03bf77381D699aD8bA64A30B', 'goerli', '0x22'],
        }
      })

      await getEthereumEvents({ id: 'test-job-id', data: { chainId: '5' } } as Job)
      expect(mintedProfileEventsSpy).toHaveBeenCalled()
      expect(resolverEventsSpy).toHaveBeenCalled()
      expect(parseLogSpy).toHaveBeenCalled()
    })
  })
})
