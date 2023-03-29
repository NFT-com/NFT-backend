import * as cacheService from '@nftcom/cache'

jest.mock('ioredis', () => jest.fn())
jest.mock('@nftcom/cache', () => ({
  redisConfig: {},
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

      require('@nftcom/cache')

      expect(cacheSpy).not.toHaveBeenCalled()
      expect(cacheService.cache).not.toBeNull()
    })
  })
})
