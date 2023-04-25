import { DataSource } from 'typeorm'

import { testDBConfig } from '@nftcom/misc'
import { db } from '@nftcom/shared/db'

import { nonWhitelistedAddress, testMockUser, testMockWallet, whitelistedAddress } from '../util/constants'
import { clearDB } from '../util/helpers'
import { getTestApolloServer } from '../util/testApolloServer'

jest.retryTimes(2)
jest.setTimeout(300000)

jest.mock('@nftcom/cache', () => ({
  redisConfig: {},
  cache: jest.fn(),
  createCacheConnection: jest.fn(),
}))

let testServer
const repositories = db.newRepositories()
let connection: DataSource
describe('wallet resolver', () => {
  describe('isAddressWhiteListed', () => {
    beforeAll(async () => {
      testServer = getTestApolloServer({})
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

  describe('updateWalletProfileId', () => {
    let profileA

    beforeAll(async () => {
      connection = await db.connectTestDB(testDBConfig)
      testServer = getTestApolloServer(repositories, testMockUser, testMockWallet, { id: '5', name: 'goerli' })
    })

    afterAll(async () => {
      await testServer.stop()
      if (!connection) return
      await connection.destroy()
    })

    beforeEach(async () => {
      testMockUser.chainId = '5'
      testMockWallet.chainId = '5'
      testMockWallet.chainName = 'goerli'

      profileA = await repositories.profile.save({
        url: 'test-profile',
        ownerWalletId: testMockWallet.id,
      })

      await repositories.wallet.save({
        ...testMockWallet,
        userId: testMockUser.id,
        createdAt: undefined,
      })
    })

    afterEach(async () => {
      await clearDB(repositories)
    })
    it('should insert the profile ID of a profile owned by the user', async () => {
      const result = await testServer.executeOperation({
        query:
          'mutation UpdateWalletProfileId($profileId: ID!) { updateWalletProfileId(profileId: $profileId) { profileId } }',
        variables: {
          profileId: profileA.id,
        },
      })

      expect(result.data.updateWalletProfileId.profileId).toBe(profileA.id)
    })

    it('should not update profile ID if profile not owned by the user', async () => {
      await repositories.profile.updateOneById(profileA.id, {
        ownerWalletId: 'something-different',
      })

      const result = await testServer.executeOperation({
        query:
          'mutation UpdateWalletProfileId($profileId: ID!) { updateWalletProfileId(profileId: $profileId) { profileId } }',
        variables: {
          profileId: profileA.id,
        },
      })

      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].statusCode).toBe('403')
      expect(result.errors[0].message).toBe(`You cannot update profile ${profileA.id} because you do not own it`)
    })

    it('should return an error if profile is not found', async () => {
      const result = await testServer.executeOperation({
        query:
          'mutation UpdateWalletProfileId($profileId: ID!) { updateWalletProfileId(profileId: $profileId) { profileId } }',
        variables: {
          profileId: 'not-a-profile-id',
        },
      })

      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].statusCode).toBe('404')
      expect(result.errors[0].message).toBe('Profile not-a-profile-id not found')
    })
  })
})
