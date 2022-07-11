import { BigNumber } from 'ethers'

const sharedLibs = jest.requireActual('@nftcom/shared')
const { core } = jest.requireActual('@nftcom/gql/service')

import { getTestApolloServer } from '../util/testApolloServer'

jest.setTimeout(30000)

jest.mock('ioredis', () => jest.fn())
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
  describe('get profile endpoint', () => {
    beforeEach(async () => {
      testServer = getTestApolloServer({
        profile: {
          findByURL: () => Promise.resolve(null),
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
  })
})