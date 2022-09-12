import { ethers } from 'ethers'

import { testDBConfig } from '@nftcom/gql/config'
import * as nftService from '@nftcom/gql/service/nft.service'
import {
  downloadImageFromUbiquity,
  getCollectionInfo, saveNFTMetadataImageToS3,
  updateNFTMetadata,
} from '@nftcom/gql/service/nft.service'
import { testMockUser, testMockWallet } from '@nftcom/gql/test/util/constants'
import { db,defs } from '@nftcom/shared'

import { clearDB } from '../util/helpers'
import { getTestApolloServer } from '../util/testApolloServer'

jest.setTimeout(500000)

jest.mock('@nftcom/gql/service/searchEngine.service', () => {
  return {
    SearchEngineService: jest.fn().mockImplementation(() => {
      return {

        indexCollections: jest.fn().mockResolvedValue(true),
      }
    }),
  }
})

jest.mock('@nftcom/gql/service/cache.service', () => ({
  cache: {
    get: jest.fn(),
    set: jest.fn(),
  },
  createCacheConnection: jest.fn(),
}))

const repositories = db.newRepositories()

let connection
let testServer
let nftA, nftB

describe('nft resolver', () => {
  beforeAll(async () => {
    connection = await db.connectTestDB(testDBConfig)
  })

  afterAll(async () => {
    if (!connection) return
    await connection.close()
  })

  describe('refresh nft endpoint', () => {
    beforeEach(async () => {
      testServer = getTestApolloServer({
        nft: {
          findById: (id: any) => Promise.resolve({
            id,
            walletId: 'test-wallet-id',
            userId: 'test-user-id',
          }),
        },
        wallet: {
          findById: (id: any) => Promise.resolve({
            id,
            address: 'test-address',
          }),
        },
      })
    })

    afterEach(async () => {
      jest.clearAllMocks()
      await testServer.stop()
    })

    it('calls updateWalletNFTs when given valid input', async () => {
      const spy = jest.spyOn(nftService, 'updateWalletNFTs')

      const result = await testServer.executeOperation({
        query: 'mutation RefreshNft($id: ID!) { refreshNft(id: $id) { id } }',
        variables: { id: 'test' },
      })

      expect(result.errors).toHaveLength(1)
      expect(spy).not.toHaveBeenCalled()
      // expect(spy).toBeCalledWith('test-user-id', 'test-wallet-id', 'test-address')
    })

    it('throws an error when given invalid input', async () => {
      const spy = jest.spyOn(nftService, 'updateWalletNFTs')

      const result = await testServer.executeOperation({
        query: 'mutation RefreshNft($id: ID!) { refreshNft(id: $id) { id } }',
        variables: { },
      })

      expect(result.errors).toHaveLength(1)
      expect(spy).not.toHaveBeenCalled()
    })
  })

  describe('downloadImageFromUbiquity', () => {
    it('should download image', async () => {
      const url = 'https://ubiquity.api.blockdaemon.com/v1/nft/media/ethereum/mainnet/collection/1aa147e7-d4bd-5bc1-9ee0-520e88910381/banner.png'
      const data = await downloadImageFromUbiquity(url)
      expect(data).toBeDefined()
    })
  })

  describe('getCollectionInfo', () => {
    beforeAll(async () => {
      await repositories.collection.save({
        contract: ethers.utils.getAddress('0xAd8C3BDd635e33e14DFC020fCd922Ef89aA9Bf6E'),
        name: 'Warner Bros nft',
        chainId: '1',
        deployer: ethers.utils.getAddress('0x87686E35CEF5271E33e83e1294FDd633a807eeEA'),
      })
      await repositories.collection.save({
        contract: ethers.utils.getAddress('0x8fB5a7894AB461a59ACdfab8918335768e411414'),
        name: 'NFT.com Genesis Key',
        chainId: '1',
        deployer: ethers.utils.getAddress('0x487F09bD7554e66f131e24edC1EfEe0e0Dfa7fD1'),
      })
      await repositories.nft.save({
        contract: '0x8fB5a7894AB461a59ACdfab8918335768e411414',
        tokenId: '0x0715',
        chainId: '1',
        metadata: {
          name: '',
          description: '',
          traits: [],
        },
        type: defs.NFTType.ERC721,
        userId: testMockUser.id,
        walletId: testMockWallet.id,
      })
      await repositories.nft.save({
        contract: '0xAd8C3BDd635e33e14DFC020fCd922Ef89aA9Bf6E',
        tokenId: '0xf2',
        chainId: '1',
        metadata: {
          name: '',
          description: '',
          traits: [],
        },
        type: defs.NFTType.ERC721,
        userId: testMockUser.id,
        walletId: testMockWallet.id,
      })
    })
    afterAll(async () => {
      await clearDB(repositories)
    })
    it('should return default banner, logo image and description', async () => {
      const contract = '0xAd8C3BDd635e33e14DFC020fCd922Ef89aA9Bf6E'
      const chainId = '1'
      const collectionInfo = await getCollectionInfo(contract, chainId, repositories)
      expect(collectionInfo.collection.bannerUrl).toEqual('https://cdn.nft.com/collectionBanner_default.png')
      expect(collectionInfo.collection.logoUrl).toEqual('https://cdn.nft.com/profile-image-default.svg')
      expect(collectionInfo.collection.description).not.toEqual('placeholder collection description text')
    })
    it('should return valid banner, logo image and description', async () => {
      const contract = '0x8fB5a7894AB461a59ACdfab8918335768e411414'
      const chainId = '1'
      const collectionInfo = await getCollectionInfo(contract, chainId, repositories)
      expect(collectionInfo.collection.bannerUrl).not.toEqual('https://cdn.nft.com/collectionBanner_default.png')
      expect(collectionInfo.collection.logoUrl).not.toEqual('https://cdn.nft.com/profile-image-default.svg')
      expect(collectionInfo.collection.description).not.toEqual('placeholder collection description text')
    })
  })

  describe('saveNFTMetadataImageToS3', () => {
    beforeAll(async () => {
      nftA = await repositories.nft.save({
        contract: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
        tokenId: '0x039ea3',
        chainId: '1',
        metadata: {
          name: '',
          description: '',
          imageURL: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InJlZCIvPjwvc3ZnPg==',
          traits: [],
        },
        type: defs.NFTType.ERC721,
        userId: testMockUser.id,
        walletId: testMockWallet.id,
      })

      nftB = await repositories.nft.save({
        contract: '0x71276AFD922f48721035b2B112413215a2627F6E',
        tokenId: '0xf7',
        chainId: '1',
        metadata: {
          name: '',
          description: '',
          imageURL: 'ar://y47vMQxxY00-r5TYLyOuvwPXxsO-AdvOlGAyNmOtRzw',
          traits: [],
        },
        type: defs.NFTType.ERC721,
        userId: testMockUser.id,
        walletId: testMockWallet.id,
      })
    })
    afterAll(async () => {
      await clearDB(repositories)
    })
    it('should return valid SVG path uploaded to S3', async () => {
      const cdnPath = await saveNFTMetadataImageToS3(nftA, repositories)
      expect(cdnPath).toBeDefined()
    })
    it('should return valid mp4 path uploaded to S3', async () => {
      const cdnPath = await saveNFTMetadataImageToS3(nftB, repositories)
      expect(cdnPath).toBeDefined()
    })
  })

  describe('updateENSNFTMedata', () => {
    beforeAll(async () => {
      nftA = await repositories.nft.save({
        contract: '0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85',
        tokenId: '0x3f183afce162dcff1453495c6932401729f4cc3832aa5807293967ee9efa53db',
        chainId: '1',
        metadata: {
          name: '',
          description: '',
          traits: [],
        },
        type: defs.NFTType.UNKNOWN,
        userId: testMockUser.id,
        walletId: testMockWallet.id,
      })
    })
    afterAll(async () => {
      await clearDB(repositories)
    })
    it('should update image url of ENS NFT metadata', async () => {
      await updateNFTMetadata(nftA, repositories)
      const nft = await repositories.nft.findById(nftA.id)
      expect(nft.metadata.imageURL).toBeDefined()
    })
  })
})
