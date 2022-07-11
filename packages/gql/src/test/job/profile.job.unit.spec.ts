import { getTestApolloServer } from '../util/testApolloServer'

let testServer
describe('wallet resolver', () => {
  describe('isAddressWhiteListed', () => {
    beforeAll(async () => {
      testServer = getTestApolloServer({
      })
    })
      
    afterAll(async () => {
      jest.clearAllMocks()
      await testServer.stop()
    })

    // TO WORK ON THE CASES
  })
})