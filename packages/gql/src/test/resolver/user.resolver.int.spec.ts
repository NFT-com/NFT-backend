import { testDBConfig } from '@nftcom/gql/config'
import { db } from '@nftcom/shared/db'

import { testMockUser, testMockWallet } from '../util/constants'
import { clearDB } from '../util/helpers'
import { getTestApolloServer } from '../util/testApolloServer'

jest.mock('@nftcom/gql/service/cache.service', () => ({
  cache: jest.fn(),
  createCacheConnection: jest.fn(),
}))

jest.mock('@nftcom/gql/service/sendgrid.service', () => ({
  sendConfirmEmail: jest.fn(),
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

  describe('sign up', () => {
    beforeAll(async () => {
      testServer = getTestApolloServer(repositories,
        testMockUser,
        testMockWallet,
      )
    })

    afterAll(async () => {
      await clearDB(repositories)
      await testServer.stop()
    })

    it('should sign up user', async () => {
      const result = await testServer.executeOperation({
        query: 'mutation SignUp($input: SignUpInput!) { signUp(input: $input) { id username } }',
        variables: {
          input: {
            email: 'user@nft.com',
            username: 'test-user',
            wallet: {
              address: '0xC345420194D9Bac1a4b8f698507Fda9ecB2E3005',
              chainId: '4',
              network: 'ethereum',
            },
          },
        },
      })

      expect(result.data.signUp.id).toBeDefined()
      expect(result.data.signUp.username).toEqual('test-user')
    })
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
        ownerAddress: testMockWallet.address,
        profileUrl: 'test-profile-url',
        destinationAddress: '0xf5de760f2e916647fd766B4AD9E85ff943cE3A2c',
        ignore: true,
        hideIgnored: false,
      })
    })

    afterAll(async () => {
      await clearDB(repositories)
      await testServer.stop()
    })

    it('should update visibility of ignored events', async () => {
      const result = await testServer.executeOperation({
        query: 'mutation Mutation($input: UpdateHideIgnoredInput!) { updateHideIgnored(input: $input) { message } }',
        variables: {
          input: {
            eventIdArray: [event.id],
            hideIgnored: true,
          },
        },
      })
      expect(result.data.updateHideIgnored.message).toBeDefined()
      expect(result.data.updateHideIgnored.message).toEqual('Updated hidden events to be invisible')
      const updatedEvent = await repositories.event.findOne({ where: { id: event.id } })
      expect(updatedEvent.hideIgnored).toEqual(true)
    })
  })

  describe('updateHidden', () => {
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
        ownerAddress: testMockWallet.address,
        profileUrl: 'test-profile-url',
        destinationAddress: '0xf5de760f2e916647fd766B4AD9E85ff943cE3A2c',
        hidden: false,
      })
    })

    afterAll(async () => {
      await clearDB(repositories)
      await testServer.stop()
    })

    it('should update visibility of events', async () => {
      const result = await testServer.executeOperation({
        query: 'mutation Mutation($input: UpdateHiddenInput!) { updateHidden(input: $input) { message } }',
        variables: {
          input: {
            eventIdArray: [event.id],
            hidden: true,
          },
        },
      })
      expect(result.data.updateHidden.message).toBeDefined()
      expect(result.data.updateHidden.message).toEqual('Events are updated to be invisible')
      const updatedEvent = await repositories.event.findOne({ where: { id: event.id } })
      expect(updatedEvent.hidden).toEqual(true)
    })
  })

  describe('getApprovedAssociations', () => {
    beforeAll(async () => {
      testMockUser.chainId = '5'
      testMockWallet.chainId = '5'
      testMockWallet.chainName = 'goerli'

      testServer = getTestApolloServer(repositories,
        testMockUser,
        testMockWallet,
        { id: '5', name: 'goerli' },
      )

      await repositories.event.save({
        chainId: 5,
        contract: '0x3a3539B6727E74fa1c5D4d39B433F0fAB5BC4F4a',
        eventName: 'AssociateSelfWithUser',
        txHash: '0x63ce7e81f3c869093f8357472597d7aac0fa2d5b49a79a42c9633850d832c967',
        ownerAddress: testMockWallet.address,
        profileUrl: 'test-profile-url',
        destinationAddress: '0xf5de760f2e916647fd766B4AD9E85ff943cE3A2c',
      })
    })

    afterAll(async () => {
      await clearDB(repositories)
      await testServer.stop()
    })

    it('should return receivers approved association request', async () => {
      const result = await testServer.executeOperation({
        query: 'query GetApprovedAssociations($profileUrl: String!) { getApprovedAssociations(profileUrl: $profileUrl) { id receiver } }',
        variables: {
          profileUrl: 'test-profile-url',
        },
      })
      expect(result.data.getApprovedAssociations.length).toBeGreaterThan(0)
      expect(result.data.getApprovedAssociations[0].receiver).toEqual('0xf5de760f2e916647fd766B4AD9E85ff943cE3A2c')
    })
  })

  describe('getRejectedAssociations', () => {
    beforeAll(async () => {
      testMockUser.chainId = '5'
      testMockWallet.chainId = '5'
      testMockWallet.chainName = 'goerli'

      testServer = getTestApolloServer(repositories,
        testMockUser,
        testMockWallet,
        { id: '5', name: 'goerli' },
      )

      await repositories.event.save({
        chainId: 5,
        contract: '0x3a3539B6727E74fa1c5D4d39B433F0fAB5BC4F4a',
        eventName: 'AssociateEvmUser',
        txHash: '0x63ce7e81f3c869093f8357472597d7aac0fa2d5b49a79a42c9633850d832c967',
        ownerAddress: testMockWallet.address,
        profileUrl: 'test-profile-url',
        destinationAddress: '0xf5de760f2e916647fd766B4AD9E85ff943cE3A2c',
        ignore: true,
      })
    })

    afterAll(async () => {
      await clearDB(repositories)
      await testServer.stop()
    })

    it('should return receivers rejected association request', async () => {
      const result = await testServer.executeOperation({
        query: 'query GetRejectedAssociations($profileUrl: String!) { getRejectedAssociations(profileUrl: $profileUrl) { id receiver } }',
        variables: {
          profileUrl: 'test-profile-url',
        },
      })
      expect(result.data.getRejectedAssociations.length).toBeGreaterThan(0)
      expect(result.data.getRejectedAssociations[0].receiver).toEqual('0xf5de760f2e916647fd766B4AD9E85ff943cE3A2c')
    })
  })

  describe('getRemovedAssociationsAsReceiver', () => {
    beforeAll(async () => {
      testMockUser.chainId = '5'
      testMockWallet.chainId = '5'
      testMockWallet.chainName = 'goerli'

      testServer = getTestApolloServer(repositories,
        testMockUser,
        testMockWallet,
        { id: '5', name: 'goerli' },
      )

      await repositories.event.save({
        chainId: 5,
        contract: '0x3a3539B6727E74fa1c5D4d39B433F0fAB5BC4F4a',
        eventName: 'CancelledEvmAssociation',
        txHash: '0x63ce7e81f3c869093f8357472597d7aac0fa2d5b49a79a42c9633850d832c967',
        ownerAddress: testMockWallet.address,
        profileUrl: 'test-profile-url',
        destinationAddress: '0xf5de760f2e916647fd766B4AD9E85ff943cE3A2b',
        ignore: false,
      })
    })

    afterAll(async () => {
      await clearDB(repositories)
      await testServer.stop()
    })

    it('should return removed associations from sender', async () => {
      const result = await testServer.executeOperation({
        query: 'query GetRemovedAssociationsForReceiver { getRemovedAssociationsForReceiver { id url owner } }',
      })
      expect(result.data.getRemovedAssociationsForReceiver.length).toBeGreaterThan(0)
      expect(result.data.getRemovedAssociationsForReceiver[0].url).toEqual('test-profile-url')
    })
  })

  describe('getRemovedAssociationsAsSender', () => {
    beforeAll(async () => {
      testMockUser.chainId = '5'
      testMockWallet.chainId = '5'
      testMockWallet.chainName = 'goerli'

      testServer = getTestApolloServer(repositories,
        testMockUser,
        testMockWallet,
        { id: '5', name: 'goerli' },
      )

      await repositories.event.save({
        chainId: 5,
        contract: '0x3a3539B6727E74fa1c5D4d39B433F0fAB5BC4F4a',
        eventName: 'RemovedAssociateProfile',
        txHash: '0x63ce7e81f3c869093f8357472597d7aac0fa2d5b49a79a42c9633850d832c967',
        ownerAddress: testMockWallet.address,
        profileUrl: 'test-profile-url',
        destinationAddress: '0xf5de760f2e916647fd766B4AD9E85ff943cE3A2b',
        ignore: false,
      })
    })

    afterAll(async () => {
      await clearDB(repositories)
      await testServer.stop()
    })

    it('should return removed associations from receiver', async () => {
      const result = await testServer.executeOperation({
        query: 'query GetRemovedAssociationsForSender($profileUrl: String!) { getRemovedAssociationsForSender(profileUrl: $profileUrl) { id receiver } }',
        variables: {
          profileUrl: 'test-profile-url',
        },
      })
      expect(result.data.getRemovedAssociationsForSender.length).toBeGreaterThan(0)
      expect(result.data.getRemovedAssociationsForSender[0].receiver).toEqual('0xf5de760f2e916647fd766B4AD9E85ff943cE3A2b')
    })
  })
})
