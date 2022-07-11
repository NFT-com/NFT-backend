import { nonWhitelistedAddress, whitelistedAddress } from '../util/constants'
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
        variables: { input: { address: whitelistedAddress } },
      })
      
      expect(result?.data?.isAddressWhitelisted).toBe(true)
      expect(result?.errors).toBeUndefined()
    })

    it('should not be whitelisted', async () => {
      const result = await testServer.executeOperation({
        query: `query Query($input: WhitelistCheckInput) {
                isAddressWhitelisted(input: $input)
              }`,
        variables: { input: { address: nonWhitelistedAddress } },
      })
      
      expect(result?.data?.isAddressWhitelisted).toBe(false)
      expect(result?.errors).toBeUndefined()
    })
  })
})
  