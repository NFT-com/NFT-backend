const sharedLibs = jest.requireActual('@nftcom/shared')

import { getTestApolloServer } from './util/testApolloServer'

jest.setTimeout(30000)

jest.mock('@nftcom/shared', () => {
  return {
    ...sharedLibs,
  }
})

let testServer
describe('bid resolver', () => {
  beforeAll(async () => {
    testServer = getTestApolloServer({
      bid: {
        findPageable: () =>
          Promise.resolve([[], 0]),
      },
    },
    {
      id: 'test-user-id',
    },
    {
      id: 'test-wallet-id',
    })
  })
  describe('myBids', () => {
    afterEach(async () => {
      jest.clearAllMocks()
      await testServer.stop()
    })

    it('should return empty array when input is invalid', async () => {
      const result = await testServer.executeOperation({
        query: 'query MyBids($input: BidsInput) { myBids(input: $input) { items { id nftType } } }',
        variables: {
          input: {
            pageInput: {
              first: 10,
            },
            profileId: 'test-profile-id',
          },
        },
      })

      expect(result.data.myBids).toBeDefined()
      expect(result.data.myBids.items).toHaveLength(0)
    })
  })
})
