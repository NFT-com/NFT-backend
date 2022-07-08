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

    // Since WHITELIST is being fetched from ABI JSON, we could directly call the function and not mock
    it('should be whitelisted', async () => {
      const result = await testServer.executeOperation({
        query: `query Query($input: WhitelistCheckInput) {
                isAddressWhitelisted(input: $input)
              }`,
        variables: { input: { address: '0xDF3c501ef5aBeFff2d7Ce1eB75B205F60C66778A' } },
      })
      
      expect(result?.data?.isAddressWhitelisted).toBe(true)
      expect(result?.errors).toBeUndefined()
    })

    it('should not be whitelisted', async () => {
      const result = await testServer.executeOperation({
        query: `query Query($input: WhitelistCheckInput) {
                isAddressWhitelisted(input: $input)
              }`,
        variables: { input: { address: '0xDEA2c39552A5bc259c520F64320e2D1008010d44' } },
      })
      
      expect(result?.data?.isAddressWhitelisted).toBe(false)
      expect(result?.errors).toBeUndefined()
    })
  })
})
  