import * as cacheService from '@nftcom/cache'
const cacheFunctions = { ...cacheService }

jest.mock('ioredis', () => jest.fn())

describe('cache service', () => {
  describe('cache connection test', () => {
    afterAll(async () => {
      jest.clearAllMocks()
    })

    // after first import, no other connection is created for a single instance of server
    it('creates only one connection', async () => {
      const cacheSpy = jest.spyOn(cacheFunctions, 'createCacheConnection')

      require('@nftcom/cache')

      expect(cacheSpy).not.toHaveBeenCalled()
      expect(cacheService.cache).not.toBeNull()
    })
  })
})
