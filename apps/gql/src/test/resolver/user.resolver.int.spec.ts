import { testDBConfig } from '@nftcom/misc'
import { db, defs } from '@nftcom/shared'

import { testMockUser, testMockWallet } from '../util/constants'
import { clearDB } from '../util/helpers'
import { getTestApolloServer } from '../util/testApolloServer'

jest.mock('@nftcom/cache', () => ({
  redisConfig: {},
  cache: jest.fn(),
  createCacheConnection: jest.fn(),
}))

jest.mock('@nftcom/gql/service/sendgrid.service', () => ({
  sendConfirmEmail: jest.fn().mockResolvedValue(true),
  sendReferralEmail: jest.fn().mockResolvedValue(true),
  sendEmailVerificationCode: jest.fn().mockResolvedValue(true),
}))

let connection
let testServer
let event, eventA
const repositories = db.newRepositories()

jest.setTimeout(300000)
jest.retryTimes(2)

describe('user resolver', () => {
  beforeAll(async () => {
    connection = await db.connectTestDB(testDBConfig)
  })

  afterAll(async () => {
    if (!connection) return
    await connection.destroy()
  })

  describe('sign up', () => {
    beforeAll(async () => {
      testServer = getTestApolloServer(repositories, testMockUser, testMockWallet)
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
              chainId: '5',
              network: 'ethereum',
            },
          },
        },
      })

      expect(result.data.signUp.id).toBeDefined()
      expect(result.data.signUp.username).toEqual('test-user')
    })
  })

  describe('updateEmail', () => {
    beforeAll(async () => {
      const user = await repositories.user.save({
        email: testMockUser.email,
        username: 'test-user',
        referralId: testMockUser.referralId,
        preferences: testMockUser.preferences,
      })
      testServer = getTestApolloServer(repositories, user, testMockWallet)
    })

    afterAll(async () => {
      await clearDB(repositories)
      await testServer.stop()
    })

    it('should update email', async () => {
      const result = await testServer.executeOperation({
        query: 'mutation UpdateEmail($input: UpdateEmailInput!) { updateEmail(input: $input) { id username email } }',
        variables: {
          input: {
            email: 'jason@nft.com',
          },
        },
      })

      expect(result.data.updateEmail.id).toBeDefined()
      expect(result.data.updateEmail.email).toEqual('jason@nft.com')
    })
  })

  describe('confirmEmail', () => {
    beforeAll(async () => {
      const user = await repositories.user.save({
        email: testMockUser.email,
        username: 'test-user',
        referralId: testMockUser.referralId,
        preferences: testMockUser.preferences,
        confirmEmailToken: 'test-token',
      })
      testServer = getTestApolloServer(repositories, user, testMockWallet)
    })

    afterAll(async () => {
      await clearDB(repositories)
      await testServer.stop()
    })

    it('should throw error while confirming email', async () => {
      const result = await testServer.executeOperation({
        query: 'mutation ConfirmEmail($token: String!) { confirmEmail(token: $token) }',
        variables: {
          token: 'test-token',
        },
      })

      expect(result.errors.length).toEqual(1)
    })
  })

  describe('updateMe', () => {
    beforeAll(async () => {
      const user = await repositories.user.save({
        email: testMockUser.email,
        username: 'test-user',
        referralId: testMockUser.referralId,
        preferences: testMockUser.preferences,
      })
      testServer = getTestApolloServer(repositories, user, testMockWallet)
    })

    afterAll(async () => {
      await clearDB(repositories)
      await testServer.stop()
    })

    it('should update email, avatarURL and preferences of user', async () => {
      const result = await testServer.executeOperation({
        query: 'mutation UpdateMe($input: UpdateUserInput!) { updateMe(input: $input) { id } }',
        variables: {
          input: {
            email: 'update@nft.com',
            avatarURL: 'https://test-server/test.png',
            preferences: {
              bidActivityNotifications: true,
              priceChangeNotifications: true,
              outbidNotifications: true,
              purchaseSuccessNotifications: true,
              promotionalNotifications: true,
            },
          },
        },
      })

      expect(result.data.updateMe.id).toBeDefined()
    })
  })

  describe('resendEmailConfirm', () => {
    beforeAll(async () => {
      const user = await repositories.user.save({
        email: testMockUser.email,
        username: 'test-user',
        referralId: testMockUser.referralId,
        preferences: testMockUser.preferences,
      })
      testServer = getTestApolloServer(repositories, user, testMockWallet)
    })

    afterAll(async () => {
      await clearDB(repositories)
      await testServer.stop()
    })

    it('should return confirmEmailToken', async () => {
      const result = await testServer.executeOperation({
        query: 'mutation ResendEmailConfirm { resendEmailConfirm { id } }',
      })

      expect(result.data.resendEmailConfirm.id).toBeDefined()
    })
  })

  describe('ignoreAssociations', () => {
    beforeAll(async () => {
      event = await repositories.event.save({
        chainId: 5,
        contract: '0x1338A9ec2Ef9906B57082dB0F67ED9E6E661F4A7',
        eventName: 'MintedProfile',
        txHash: '0x62fe7e81f3c869093f8357472597d7aac0fa2d5b49a79a42c9633850d832c967',
        profileUrl: 'test-profile-url',
        destinationAddress: testMockWallet.address,
      })
      eventA = await repositories.event.save({
        chainId: 5,
        contract: '0x1338A9ec2Ef9906B57082dB0F67ED9E6E661F4A7',
        eventName: 'MintedProfile',
        txHash: '0x3cb67f753de1816b852aea30cf9bf2919a63105b4b2c391d71517100a87f5328',
        profileUrl: 'test-profile-url-1',
        destinationAddress: testMockWallet.address,
      })
      testServer = getTestApolloServer(repositories, testMockUser, testMockWallet)
    })

    afterAll(async () => {
      await clearDB(repositories)
      await testServer.stop()
    })

    it('should ignoreAssociations', async () => {
      const result = await testServer.executeOperation({
        query:
          'mutation IgnoreAssociations($eventIdArray: [String]!) { ignoreAssociations(eventIdArray: $eventIdArray) { ignore } }',
        variables: {
          eventIdArray: [event.id, eventA.id],
        },
      })

      expect(result.data.ignoreAssociations.length).toEqual(2)
      expect(result.data.ignoreAssociations[0].ignore).toEqual(true)
      expect(result.data.ignoreAssociations[1].ignore).toEqual(true)
    })
  })

  describe('me authenticated call', () => {
    beforeAll(async () => {
      testServer = getTestApolloServer({}, testMockUser, testMockWallet)
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
      testServer = getTestApolloServer({})
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

      testServer = getTestApolloServer(repositories, testMockUser, testMockWallet, { id: '5', name: 'goerli' })

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

      testServer = getTestApolloServer(repositories, testMockUser, testMockWallet, { id: '5', name: 'goerli' })

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

      testServer = getTestApolloServer(repositories, testMockUser, testMockWallet, { id: '5', name: 'goerli' })

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
        query:
          'query GetApprovedAssociations($profileUrl: String!) { getApprovedAssociations(profileUrl: $profileUrl) { id receiver } }',
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

      testServer = getTestApolloServer(repositories, testMockUser, testMockWallet, { id: '5', name: 'goerli' })

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
        query:
          'query GetRejectedAssociations($profileUrl: String!) { getRejectedAssociations(profileUrl: $profileUrl) { id receiver } }',
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

      testServer = getTestApolloServer(repositories, testMockUser, testMockWallet, { id: '5', name: 'goerli' })

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

      testServer = getTestApolloServer(repositories, testMockUser, testMockWallet, { id: '5', name: 'goerli' })

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
        query:
          'query GetRemovedAssociationsForSender($profileUrl: String!) { getRemovedAssociationsForSender(profileUrl: $profileUrl) { id receiver } }',
        variables: {
          profileUrl: 'test-profile-url',
        },
      })
      expect(result.data.getRemovedAssociationsForSender.length).toBeGreaterThan(0)
      expect(result.data.getRemovedAssociationsForSender[0].receiver).toEqual(
        '0xf5de760f2e916647fd766B4AD9E85ff943cE3A2b',
      )
    })
  })

  describe('getProfileActions', () => {
    beforeAll(async () => {
      testMockUser.chainId = '5'
      testMockWallet.chainId = '5'
      testMockWallet.chainName = 'goerli'

      testServer = getTestApolloServer(repositories, testMockUser, testMockWallet, { id: '5', name: 'goerli' })

      await repositories.incentiveAction.save({
        profileUrl: 'test-profile',
        userId: testMockUser.id,
        task: defs.ProfileTask.CUSTOMIZE_PROFILE,
        point: defs.ProfileTaskPoint.CUSTOMIZE_PROFILE,
      })

      await repositories.incentiveAction.save({
        profileUrl: 'test-profile',
        userId: testMockUser.id,
        task: defs.ProfileTask.ISSUE_NFTS,
        point: defs.ProfileTaskPoint.ISSUE_NFTS,
      })

      await repositories.incentiveAction.save({
        profileUrl: 'test-profile-1',
        userId: testMockUser.id,
        task: defs.ProfileTask.CREATE_NFT_PROFILE,
        point: defs.ProfileTaskPoint.CREATE_NFT_PROFILE,
      })

      await repositories.incentiveAction.save({
        profileUrl: 'test-profile-2',
        userId: null,
        task: defs.ProfileTask.CREATE_NFT_PROFILE,
        point: defs.ProfileTaskPoint.CREATE_NFT_PROFILE,
      })
    })

    afterAll(async () => {
      await clearDB(repositories)
      await testServer.stop()
    })

    it('should return incentive actions for user', async () => {
      const result = await testServer.executeOperation({
        query: 'query GetProfileActions { getProfileActions { profileUrl action point } }',
      })
      expect(result.data.getProfileActions.length).toEqual(3)
    })
  })

  describe('profilesActionsWithPoints', () => {
    beforeAll(async () => {
      testMockUser.chainId = '5'
      testMockWallet.chainId = '5'
      testMockWallet.chainName = 'goerli'

      testServer = getTestApolloServer(repositories, testMockUser, testMockWallet, { id: '5', name: 'goerli' })

      await repositories.incentiveAction.save({
        profileUrl: 'test-profile',
        userId: testMockUser.id,
        task: defs.ProfileTask.CREATE_NFT_PROFILE,
        point: defs.ProfileTaskPoint.CREATE_NFT_PROFILE,
      })

      await repositories.incentiveAction.save({
        profileUrl: 'test-profile',
        userId: testMockUser.id,
        task: defs.ProfileTask.CUSTOMIZE_PROFILE,
        point: defs.ProfileTaskPoint.CUSTOMIZE_PROFILE,
      })

      await repositories.incentiveAction.save({
        profileUrl: 'test-profile-1',
        userId: testMockUser.id,
        task: defs.ProfileTask.CUSTOMIZE_PROFILE,
        point: defs.ProfileTaskPoint.CUSTOMIZE_PROFILE,
      })
    })

    afterAll(async () => {
      await clearDB(repositories)
      await testServer.stop()
    })

    it('should return incentive profile actions with total points', async () => {
      const result = await testServer.executeOperation({
        query: 'query Me { me { profilesActionsWithPoints { url action totalPoints } } }',
      })
      expect(result.data.me.profilesActionsWithPoints.length).toEqual(2)
      expect(result.data.me.profilesActionsWithPoints[0].totalPoints).toEqual(6)
    })
  })

  describe('sendReferEmail', () => {
    beforeEach(async () => {
      testMockUser.chainId = '5'
      testMockWallet.chainId = '5'
      testMockWallet.chainName = 'goerli'

      const user = await repositories.user.save({
        email: testMockUser.email,
        username: 'test-user',
        referralId: testMockUser.referralId,
        preferences: testMockUser.preferences,
      })

      await repositories.profile.save({
        url: 'test-profile',
        ownerUserId: user.id,
        ownerWalletId: testMockWallet.id,
        chainId: '5',
      })

      testServer = getTestApolloServer(repositories, user, testMockWallet, { id: '5', name: 'goerli' })
    })

    afterEach(async () => {
      await clearDB(repositories)
      await testServer.stop()
    })

    it('should send refer emails', async () => {
      const result = await testServer.executeOperation({
        query: 'mutation Mutation($input: SendReferEmailInput!) { sendReferEmail(input: $input) { message } }',
        variables: {
          input: {
            emails: ['test@example.com', 'test1@example.com'],
            profileUrl: 'test-profile',
          },
        },
      })
      expect(result.data.sendReferEmail.message).toBeDefined()
      expect(result.data.sendReferEmail.message).toEqual('Referral emails are sent to 2 addresses.')
      const userA = await repositories.user.findByEmail('test@example.com')
      expect(userA).toBeDefined()
      const userB = await repositories.user.findByEmail('test1@example.com')
      expect(userB).toBeDefined()
    })

    it('should return refer emails sent before', async () => {
      await testServer.executeOperation({
        query: 'mutation Mutation($input: SendReferEmailInput!) { sendReferEmail(input: $input) { message } }',
        variables: {
          input: {
            emails: ['test@example.com', 'test1@example.com'],
            profileUrl: 'test-profile',
          },
        },
      })
      const result = await testServer.executeOperation({
        query:
          'query GetSentReferralEmails($profileUrl: String!) { getSentReferralEmails(profileUrl: $profileUrl) { email accepted timestamp } }',
        variables: {
          profileUrl: 'test-profile',
        },
      })
      expect(result.data.getSentReferralEmails.length).toEqual(2)
    })
  })
})
