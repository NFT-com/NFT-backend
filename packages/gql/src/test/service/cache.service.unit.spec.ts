import * as cacheService from '@nftcom/gql/service/cache.service'

jest.mock('ioredis', () => jest.fn())
jest.mock('@nftcom/gql/service/cache.service', () => ({
  createCacheConnection: jest.fn(),
}))

describe('cache service', () => {
  describe('cache connection test', () => {
    afterAll(async () => {
      jest.clearAllMocks()
    })

    // after first import, no other connection is created for a single instance of server
    it('creates only one connection', async () => {
      const cacheSpy = jest.spyOn(cacheService as any, 'createCacheConnection')

      require('@nftcom/gql/service/cache.service')

      expect(cacheSpy).not.toHaveBeenCalled()
      expect(cacheService.cache).not.toBeNull()
    })
  })
})