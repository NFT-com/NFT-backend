import { testMockUser, testMockWallet } from '../util/constants'
import { getTestApolloServer } from '../util/testApolloServer'

let testServer
describe('user resolver', () => {
  describe('me authenticated call', () => {
    beforeAll(async () => {
      testServer = getTestApolloServer({

      },
      testMockUser,
      testMockWallet,
      )
    })
      
    afterAll(async () => {
      jest.clearAllMocks()
      await testServer.stop()
    })

    it('should send me back', async () => {
      const result = await testServer.executeOperation({
        query: `query Me {
                me {
                    id
                }
              }`,
      })
      expect(result?.data?.me?.id).toBe(testMockUser.id)
    })
  })

  describe('me unauthenticated call', () => {
    beforeAll(async () => {
      testServer = getTestApolloServer({},
      )
    })
      
    afterAll(async () => {
      jest.clearAllMocks()
      await testServer.stop()
    })

    it('should throw an error', async () => {
      const result = await testServer.executeOperation({
        query: `query Me {
                me {
                    id
                }
              }`,
      })
      expect(result?.errors).toHaveLength(1)
    })
  })
})