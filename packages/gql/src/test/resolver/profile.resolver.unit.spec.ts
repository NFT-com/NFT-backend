import { BigNumber } from 'ethers'

import { mockUpdateProfileInput, testMockProfiles, testMockUser, testMockWallet } from '../util/constants'

const sharedLibs = jest.requireActual('@nftcom/shared')
const { core } = jest.requireActual('@nftcom/gql/service')

import { Connection } from 'typeorm'

import { testDBConfig } from '@nftcom/gql/config'
import { db, defs } from '@nftcom/shared/'

import { clearDB } from '../util/helpers'
import { getTestApolloServer } from '../util/testApolloServer'

jest.setTimeout(300000)
jest.retryTimes(2)

jest.mock('@nftcom/gql/service/cache.service', () => ({
  cache: {
    get: jest.fn(),
    set: jest.fn(),
  },
  CacheKeys: {
    GENESIS_KEY_OWNERS: 'genesis_key_owners',
  },
  createCacheConnection: jest.fn(),
}))

jest.mock('@nftcom/gql/service', () => {
  return {
    core: {
      ...core,
      createProfileFromEvent: () => {
        return {
          id: 'testId',
          createdAt: 0,
          displayType: sharedLibs.defs.ProfileDisplayType.Collection,
          layoutType: sharedLibs.defs.ProfileLayoutType.Mosaic,
          url: 'test',
          chainId: '1',
        }
      },
    },
  }
})
jest.mock('@nftcom/shared', () => {
  return {
    ...sharedLibs,
    typechain: {
      NftProfile__factory: {
        connect: () => {
          return {
            getTokenId: () => Promise.resolve(BigNumber.from(1)),
            ownerOf: () => Promise.resolve('0x0000000000000000000000000000000000000000'),
          }
        },
      },
    },
  }
})

const repositories = db.newRepositories()
let connection : Connection
let testServer
let walletA, walletB
let profileA, profileB

describe('profile resolver', () => {
  beforeAll(async () => {
    connection = await db.connectTestDB(testDBConfig)
  })

  afterAll(async () => {
    if (!connection) return
    await connection.close()
  })

  // profileByURL
  describe('get profile endpoint', () => {
    beforeEach(async () => {
      testServer = getTestApolloServer({
        profile: {
          findOne: (data) => {
            if (data.where.url === testMockProfiles.url) {
              return Promise.resolve(testMockProfiles)
            }
            return Promise.resolve(null)
          },
        },
      })
    })

    afterEach(async () => {
      jest.clearAllMocks()
      await testServer.stop()
    })

    it('should query profile by URL', async () => {
      const result = await testServer.executeOperation({
        query: `query Profile($url: String!, $chainId: String!) { 
          profile(url: $url, chainId: $chainId) { 
            id 
            layoutType 
          } 
        }`,
        variables: { url: 'test', chainId: '4' },
      })

      console.log('result: ', result)

      expect(result.errors).toBeUndefined()
    })

    it('gets passive profile by url', async () => {
      const result = await testServer.executeOperation({
        query: `query ProfilePassive($url: String!, $chainId: String!) {
          profilePassive(url: $url, chainId: $chainId) {
            id
            bannerURL
            createdAt
            description
            displayType
            tokenId
            photoURL
            url
          }
        }`,
        variables: { url: testMockProfiles.url, chainId: '4' },
      })
      expect(result?.data?.profilePassive?.url).toBe(testMockProfiles.url)
    })
  })

  // myProfiles
  describe('myProfiles', () => {
    beforeAll(async () => {
      testServer = getTestApolloServer({
        profile: {
          find: (filter) => {
            if (filter?.where?.ownerUserId === testMockUser.id) {
              return Promise.resolve([testMockProfiles])
            }
            return null
          },
          findById: (id) => {
            if (id === testMockProfiles.id) {
              return Promise.resolve({ ...testMockProfiles, ownerUserId: testMockUser.id })
            }
            return null
          },
          save: (data) => {
            if (data.url === testMockProfiles.url) {
              return Promise.resolve(data)
            }
            return null
          },
        },
      },
      testMockUser,
      testMockWallet,
      )
    })
    afterAll(async () => {
      jest.clearAllMocks()
      await testServer.stop()
    })

    it('should query owned profiles', async () => {
      const result = await testServer.executeOperation({
        query: `query MyProfiles($input: ProfilesInput) {
          myProfiles(input: $input) {
            items {
              id
              bannerURL
              createdAt
              description
              displayType
              layoutType
              isOwnedByMe
              gkIconVisible
              nftsDescriptionsVisible
              deployedContractsVisible
              owner {
                id
              }
              tokenId
              photoURL
              status
              url
            }
          }
        }`,
        variables: {
          input: {
            statuses: 'Owned',
          },
        },
      })
      expect(result.data.myProfiles.items.length).toBe(1)
    })

    it('should update profile', async () => {
      const result = await testServer.executeOperation({
        query: `mutation UpdateProfile($input: UpdateProfileInput!) {
          updateProfile(input: $input) {
            id
            bannerURL
            description
          }
        }`,
        variables: { input: mockUpdateProfileInput },
      })
      expect(result?.data?.updateProfile?.description).toBe(mockUpdateProfileInput.description)
    })
  })

  describe('clearGKIconVisible', () => {
    beforeAll(async () => {
      testMockUser.chainId = '5'
      testMockWallet.chainId = '5'
      testMockWallet.chainName = 'goerli'

      testServer = getTestApolloServer(repositories,
        testMockUser,
        testMockWallet,
        { id: '5', name: 'goerli' },
      )

      walletA = await repositories.wallet.save({
        userId: 'vPVIuNzLVBdIuyAMTm2rZ',
        chainId: '5',
        chainName: 'goerli',
        network: 'ethereum',
        address: '0x59495589849423692778a8c5aaCA62CA80f875a4',
      })

      walletB = await repositories.wallet.save({
        userId: 'f6YMxVjHWqsn26o6Xt2Gt',
        chainId: '5',
        chainName: 'goerli',
        network: 'ethereum',
        address: '0xC345420194D9Bac1a4b8f6985070000000000000',
      })

      profileA = await repositories.profile.save({
        url: 'testprofile1',
        ownerUserId: 'vPVIuNzLVBdIuyAMTm2rZ',
        ownerWalletId: walletA.id,
        tokenId: '0',
        status: defs.ProfileStatus.Owned,
        gkIconVisible: true,
        layoutType: defs.ProfileLayoutType.Default,
        chainId: '5',
      })

      profileB = await repositories.profile.save({
        url: 'testprofile2',
        ownerUserId: 'f6YMxVjHWqsn26o6Xt2Gt',
        ownerWalletId: walletB.id,
        tokenId: '2',
        status: defs.ProfileStatus.Owned,
        gkIconVisible: true,
        layoutType: defs.ProfileLayoutType.Default,
        chainId: '5',
      })
    })

    afterAll(async () => {
      await clearDB(repositories)
      await testServer.stop()
    })

    it('should clear GK icon visible', async () => {
      const result = await testServer.executeOperation({
        query: 'mutation ClearGKIconVisible { clearGKIconVisible { message } }',
      })

      expect(result.data.clearGKIconVisible.message).toBeDefined()
      expect(result.data.clearGKIconVisible.message).toEqual('Cleared GK icon visible for 1 profiles')
      profileA = await repositories.profile.findById(profileA.id)
      expect(profileA.gkIconVisible).toEqual(true)
      profileB = await repositories.profile.findById(profileB.id)
      expect(profileB.gkIconVisible).toEqual(false)
    })
  })

  describe('updateProfileView', () => {
    beforeAll(async () => {
      testServer = getTestApolloServer(repositories,
        testMockUser,
        testMockWallet,
      )

      await repositories.profile.save({
        url: 'testprofile',
        ownerUserId: 'test-user-id',
        ownerWalletId: 'test-wallet-id',
        tokenId: '0',
        status: defs.ProfileStatus.Owned,
        gkIconVisible: true,
        layoutType: defs.ProfileLayoutType.Default,
        chainId: '4',
        profileView: defs.ProfileViewType.Gallery,
      })
    })

    afterAll(async () => {
      await clearDB(repositories)
      await testServer.stop()
    })

    it('should update profile view type', async () => {
      const result = await testServer.executeOperation({
        query: 'mutation UpdateProfileView($input: UpdateProfileViewInput) { updateProfileView(input: $input) { profileView } }',
        variables: {
          input: {
            url: 'testprofile',
            profileViewType: defs.ProfileViewType.Collection,
          },
        },
      })

      expect(result.data.updateProfileView.profileView).toBeDefined()
      expect(result.data.updateProfileView.profileView).toEqual(defs.ProfileViewType.Collection)
    })

    it('should throw error if profile is not existing', async () => {
      const result = await testServer.executeOperation({
        query: 'mutation UpdateProfileView($input: UpdateProfileViewInput) { updateProfileView(input: $input) { profileView } }',
        variables: {
          input: {
            url: 'testprofile1',
            profileViewType: defs.ProfileViewType.Collection,
          },
        },
      })

      expect(result.errors).toBeDefined()
    })
  })
})
