import { getTestApolloServer } from './util/testApolloServer'

jest.setTimeout(20000)

jest.mock('ioredis', () => jest.fn())

describe('nft resolver', () => {
  describe('refresh nft endpoint', () => {
    let testServer
    beforeEach(async () => {
      testServer = getTestApolloServer({
        profile: {
          findByURL: (url: any) => Promise.resolve({
            id: 'test',
            url: url,
            layoutType: 'Mosaic',
          }),
        },
      })
    })

    afterEach(() => {
      jest.clearAllMocks()
    })

    it('should query profile by URL', async () => {
      const result = await testServer.executeOperation({
        query: `query Profile($url: String!) { 
          profile(url: $url) { 
            id 
            layoutType 
          } 
        }`,
        variables: { url: 'test' },
      })
            
      expect(result.errors).toBeUndefined()
    })
  })
})
