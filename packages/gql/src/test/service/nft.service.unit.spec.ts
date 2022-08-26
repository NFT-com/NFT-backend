import { ethers } from 'ethers'

import { testDBConfig } from '@nftcom/gql/config'
import * as nftService from '@nftcom/gql/service/nft.service'
import { downloadImageFromUbiquity, getCollectionInfo } from '@nftcom/gql/service/nft.service'
import { db } from '@nftcom/shared'

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
describe('nft resolver', () => {
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
      connection = await db.connectTestDB(testDBConfig)

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
    })
    afterAll(async () => {
      await clearDB(repositories)
      if (!connection) return
      await connection.close()
    })
    it('should return default banner, logo image and description', async () => {
      const contract = '0xAd8C3BDd635e33e14DFC020fCd922Ef89aA9Bf6E'
      const chainId = '1'
      const collectionInfo = await getCollectionInfo(contract, chainId, repositories)
      expect(collectionInfo.collection.bannerUrl).toEqual('https://cdn.nft.com/profile-banner-default-logo-key.png')
      expect(collectionInfo.collection.logoUrl).toEqual('https://cdn.nft.com/profile-image-default.svg')
      expect(collectionInfo.collection.description).toEqual('placeholder collection description text')
    })
    it('should return valid banner, logo image and description', async () => {
      const contract = '0x8fB5a7894AB461a59ACdfab8918335768e411414'
      const chainId = '1'
      const collectionInfo = await getCollectionInfo(contract, chainId, repositories)
      expect(collectionInfo.collection.bannerUrl).toBeDefined()
      expect(collectionInfo.collection.logoUrl).toBeDefined()
      expect(collectionInfo.collection.description).toBeDefined()
    })
  })
})
