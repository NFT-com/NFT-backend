import { testDBConfig } from '@nftcom/gql/config'
import { db } from '@nftcom/shared/db'

import { testMockUser, testMockWallet } from '../util/constants'
import { clearDB } from '../util/helpers'
import { getTestApolloServer } from '../util/testApolloServer'

jest.mock('@nftcom/gql/service/cache.service', () => ({
  cache: jest.fn(),
  createCacheConnection: jest.fn(),
}))

let connection
let testServer
let event
const repositories = db.newRepositories()

jest.setTimeout(300000)
jest.retryTimes(2)

describe('user resolver', () => {
  beforeAll(async () => {
    connection = await db.connectTestDB(testDBConfig)
  })

  afterAll(async () => {
    if (!connection) return
    await connection.close()
  })

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

  describe('updateHideIgnored', () => {
    beforeAll(async () => {
      testMockUser.chainId = '5'
      testMockWallet.chainId = '5'
      testMockWallet.chainName = 'goerli'

      testServer = getTestApolloServer(repositories,
        testMockUser,
        testMockWallet,
        { id: '5', name: 'goerli' },
      )

      event = await repositories.event.save({
        chainId: 5,
        contract: '0x45d296A1042248F48f484c6f2be01006D26fCBF0',
        eventName: 'AssociateEvmUser',
        txHash: '0x62fe7e81f3c869093f8357472597d7aac0fa2d5b49a79a42c9633850d832c967',
        ownerAddress: '0xd1D9F52d63e3736908c6e7D868f785d30Af5e3AC',
        profileUrl: 'test-profile-url',
        destinationAddress: '0xf5de760f2e916647fd766B4AD9E85ff943cE3A2b',
        ignore: true,
        hideIgnored: false,
      })
    })

    afterAll(async () => {
      await clearDB(repositories)
      await testServer.stop()
    })

    it('should update visibility of hidden events', async () => {
      const result = await testServer.executeOperation({
        query: 'mutation Mutation($input: UpdateHideIgnoredInput!) { updateHideIgnored(input: $input) { message } }',
        variables: {
          input: {
            eventIdArray: [event.id],
            showOrHide: false,
          },
        },
      })
      expect(result.data.updateHideIgnored.message).toBeDefined()
      expect(result.data.updateHideIgnored.message).toEqual('Updated hidden events to be invisible')
      const updatedEvent = await repositories.event.findOne({ where: { id: event.id } })
      expect(updatedEvent.hideIgnored).toEqual(true)
    })
  })
})
