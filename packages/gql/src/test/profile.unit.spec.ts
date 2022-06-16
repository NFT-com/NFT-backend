import { getTestApolloServer } from './util/testApolloServer'

jest.setTimeout(20000)

jest.mock('ioredis', () => jest.fn())

describe('nft resolver', () => {
  describe('refresh nft endpoint', () => {
    let testServer
    beforeEach(async () => {
      testServer = getTestApolloServer({})
    })

    afterEach(() => {
      jest.clearAllMocks()
    })

    it('should accept profile layout type input', async () => {
      console.log(testServer) // todo: write a test here.
    })
  })
})
