import { BigNumber } from 'ethers'

import { mockUpdateProfileInput,testMockProfiles, testMockUser, testMockWallet } from '../util/constants'

const sharedLibs = jest.requireActual('@nftcom/shared')
const { core } = jest.requireActual('@nftcom/gql/service')

import { getTestApolloServer } from '../util/testApolloServer'

jest.setTimeout(30000)

jest.mock('@nftcom/gql/service/cache.service', () => ({
  cache: jest.fn(),
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

let testServer
describe('profile resolver', () => {
  // profileByURL
  describe('get profile endpoint', () => {
    beforeEach(async () => {
      testServer = getTestApolloServer({
        profile: {
          findByURL: (url) => {
            if (url === testMockProfiles.url) {
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
        query: `query Profile($url: String!) { 
          profile(url: $url) { 
            id 
            layoutType 
          } 
        }`,
        variables: { url: 'test' },
      })

      expect(result.errors).toBeUndefined()
    })

    it('gets passive profile by url', async () => {
      const result = await testServer.executeOperation({
        query: `query ProfilePassive($url: String!) {
          profilePassive(url: $url) {
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
        variables: { url: testMockProfiles.url },
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
})