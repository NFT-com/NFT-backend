import { Job } from 'bull'
import { DeepPartial } from 'typeorm'

import { nftExternalOrdersOnDemand, repositories } from '@nftcom/gql/job/nft.job'
import * as cacheService from '@nftcom/gql/service/cache.service'
import * as looksrareService from '@nftcom/gql/service/looksare.service'
import * as nftService from '@nftcom/gql/service/nft.service'
import * as openseaService from '@nftcom/gql/service/opensea.service'
import { entity } from '@nftcom/shared/db'

import { nftAMockDataNullPreview, nftBMockDataNullPreview } from '../util/constants'

jest.mock('@nftcom/gql/service/cache.service', () => ({
  cache: {
    zrevrangebyscore: jest.fn().mockReturnValue(['contract:1']),
    zscore: jest.fn().mockReturnValue(0),
  },
  CacheKeys: {
    REFRESH_NFT_ORDERS_EXT: 'refresh_nft_orders_ext_test',
    REFRESHED_NFT_ORDERS_EXT: 'refreshed_nft_orders_ext_test',
  },
  createCacheConnection: jest.fn(),
  removeExpiredTimestampedZsetMembers: jest.fn().mockImplementation(
    () => Promise.resolve(null),
  ),
    
}))

jest.mock('@nftcom/gql/job/profile.job', () => {
  return {
    repositories: {
      nft: {
        find: () => {
          return Promise.resolve()},
        updateOneById: (id: string, nft: DeepPartial<entity.NFT>) =>{
          return Promise.resolve({ id, ...nft })},
      },
    },
  }
})

const FETCH_EXTERNAL_ORDERS_ON_DEMAND = 'FETCH_EXTERNAL_ORDERS_ON_DEMAND'
const GENERATE_NFTS_PREVIEW_LINK = 'GENERATE_PREVIEW_LINK_FOR_NFTS'

describe('nft job', () => {
  afterAll(() => {
    jest.clearAllMocks()
  })
  describe('external order on demand', () => {
    it('executes retrieveMulitpleOpenseaOrders and retrieveLooksrareMultipleOrders', async () => {
      const cacheExpSpy = jest.spyOn(cacheService, 'removeExpiredTimestampedZsetMembers')
        
      const osOrdersSpy = jest.spyOn(openseaService, 'retrieveMultipleOrdersOpensea')
        .mockImplementationOnce(
          () => Promise.resolve({
            listings: [],
            offers: [],
          }),
        )
      const lrSpy = jest.spyOn(looksrareService, 'retrieveMultipleOrdersLooksrare')
        .mockImplementationOnce(
          () => Promise.resolve({
            listings: [],
            offers: [],
          }),
        )
      await nftExternalOrdersOnDemand({ id: 'test-job-id', data: { FETCH_EXTERNAL_ORDERS_ON_DEMAND,
        chainId: process.env.CHAIN_ID } } as Job)
    
      expect(cacheExpSpy).toHaveBeenCalledTimes(1)
      expect(osOrdersSpy).toHaveBeenCalledTimes(1)
      expect(lrSpy).toHaveBeenCalledTimes(1)
    })
  })
})