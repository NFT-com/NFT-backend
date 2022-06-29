import { getTestApolloServer } from './util/testApolloServer'

jest.setTimeout(30000)

let testServer
describe('approval resolver', () => {
  describe('approveAmount', () => {
    beforeEach(async () => {
      testServer = getTestApolloServer({
        wallet: {
          findByNetworkChainAddress: (network: string, chainId: string, address: string) =>
            Promise.resolve({
              id: 'test-id',
              address: address,
            }),
        },
      })
    })

    afterEach(async () => {
      jest.clearAllMocks()
      await testServer.stop()
    })

    it('throws an error when input is invalid', async () => {
      const result = await testServer.executeOperation({
        query: 'mutation approveAmount($input: ApprovalInput!) { approveAmount(input: $input) { id } }',
        variables: {
          input: {
            amount: 100000,
            currency: '0x0000000000000000000000000000000000000000',
          },
        },
      })

      expect(result.errors).toHaveLength(6)
    })
  })
})
