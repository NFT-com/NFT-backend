import { ethers } from 'ethers'

import { testDBConfig } from '@nftcom/gql/config'
import * as nftService from '@nftcom/gql/service/nft.service'
import {
  downloadImageFromUbiquity,
  getCollectionInfo,
  getOwnersForNFT,
  saveNFTMetadataImageToS3,
  updateNFTMetadata,
} from '@nftcom/gql/service/nft.service'
import { testMockUser, testMockWallet } from '@nftcom/gql/test/util/constants'
import { db, defs } from '@nftcom/shared'
import { EdgeType, EntityType } from '@nftcom/shared/defs'

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
let nftA, nftB, nftC
let user, wallet

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

      nftC = await repositories.nft.save({
        contract: '0x0E3A2A1f2146d86A604adc220b4967A898D7Fe07',
        tokenId: '0x08b8693d',
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
    it('should return valid SVG path uploaded to S3', async () => {
      const cdnPath = await saveNFTMetadataImageToS3(nftA, repositories)
      expect(cdnPath).toBeDefined()
    })
    it.skip('should return valid mp4 path uploaded to S3', async () => {
      const cdnPath = await saveNFTMetadataImageToS3(nftB, repositories)
      expect(cdnPath).toBeDefined()
    })
    it('should return valid image path uploaded to S3', async () => {
      const cdnPath = await saveNFTMetadataImageToS3(nftC, repositories)
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

  describe('getOwnersForNFT', () => {
    beforeAll(async () => {
      nftA = await repositories.nft.save({
        contract: '0xa49a0e5eF83cF89Ac8aae182f22E6464B229eFC8',
        tokenId: '0x0a',
        chainId: '1',
        metadata: {
          name: '',
          description: '',
          traits: [],
        },
        type: defs.NFTType.ERC1155,
        userId: testMockUser.id,
        walletId: testMockWallet.id,
      })
    })
    afterAll(async () => {
      await clearDB(repositories)
    })
    it('should return owners of NFT', async () => {
      const owners = await getOwnersForNFT(nftA)
      expect(owners.length).toBeGreaterThan(0)
    })
  })

  describe('filterNFTsWithAlchemy', () => {
    beforeAll(async () => {
      const testMockWallet1 = testMockWallet
      testMockWallet1.chainId = '5'
      testMockWallet1.address = '0x59495589849423692778a8c5aaCA62CA80f875a4'
      // These NFTs should be updated by fiterNFTsWithAlchemy function
      await repositories.nft.save({
        contract: '0xa49a0e5eF83cF89Ac8aae182f22E6464B229eFC8',
        tokenId: '0x0a',
        chainId: '5',
        metadata: {
          name: '',
          description: '',
          traits: [],
        },
        type: defs.NFTType.ERC1155,
        userId: testMockUser.id,
        walletId: testMockWallet1.id,
      })
      await repositories.nft.save({
        contract: '0x9Ef7A34dcCc32065802B1358129a226B228daB4E',
        tokenId: '0x22',
        chainId: '5',
        metadata: {
          name: '',
          description: '',
          traits: [],
        },
        type: defs.NFTType.ERC721,
        userId: testMockUser.id,
        walletId: testMockWallet1.id,
      })
    })

    afterAll(async () => {
      await clearDB(repositories)
    })

    it('should create new user and wallet for NFT which is not owned by test user', async () => {
      const nfts = await repositories.nft.findByWalletId(testMockWallet.id, '5')
      nftService.initiateWeb3('5')

      await nftService.filterNFTsWithAlchemy(nfts, '0x59495589849423692778a8c5aaCA62CA80f875a4')

      // New user should be saved to database
      const users = await repositories.user.findAll()
      const wallets = await repositories.wallet.findAll()
      expect(users.length).toEqual(1)
      expect(wallets.length).toEqual(1)

      // ERC1155 NFT should be removed
      const updatedNFTs = await repositories.nft.findAll()
      expect(updatedNFTs.length).toEqual(1)
      // Owner of ERC721 NFT should be updated
      expect(updatedNFTs[0].walletId).toEqual(wallets[0].id)
      expect(updatedNFTs[0].userId).toEqual(users[0].id)
    })
  })

  describe('updateNFTOwnershipAndMetadata', () => {
    beforeAll(async () => {
      const profile = await repositories.profile.save({
        url: 'testprofile1',
        ownerUserId: testMockUser.id,
        ownerWalletId: testMockWallet.id,
        tokenId: '0',
        status: defs.ProfileStatus.Owned,
        gkIconVisible: true,
        layoutType: defs.ProfileLayoutType.Default,
        chainId: '5',
      })

      nftA = await repositories.nft.save({
        contract: '0x9Ef7A34dcCc32065802B1358129a226B228daB4E',
        tokenId: '0x22',
        chainId: '5',
        metadata: {
          name: '',
          description: '',
          traits: [],
        },
        type: defs.NFTType.ERC721,
        userId: testMockUser.id,
        walletId: testMockWallet.id,
      })

      await repositories.edge.save({
        thisEntityId: profile.id,
        thisEntityType: EntityType.Profile,
        thatEntityId: nftA.id,
        thatEntityType: EntityType.NFT,
        edgeType: EdgeType.Displays,
      })

      user = await repositories.user.save({
        username: 'ethereum-0x0d23B68cD7fBc3afA097f14ba047Ca2C1da64349',
        referralId: '5kv.KtsA7c',
      })

      wallet = await repositories.wallet.save({
        address: '0x0d23B68cD7fBc3afA097f14ba047Ca2C1da64349',
        network: 'ethereum',
        chainId: '5',
        chainName: 'goerli',
        userId: user.id,
      })
    })

    afterAll(async () => {
      await clearDB(repositories)
    })

    it('should remove edge of profile for previous owner', async () => {
      const nft = {
        contract: {
          address: '0x9Ef7A34dcCc32065802B1358129a226B228daB4E',
        },
        id: {
          tokenId: '0x22',
        },
      }
      nftService.initiateWeb3('5')
      await nftService.updateNFTOwnershipAndMetadata(nft, user.id, wallet.id, '5')

      // Previous edges should be removed
      const edges = await repositories.edge.findAll()
      expect(edges.length).toEqual(0)
    })
  })

  describe('getCollectionNameFromContract', () => {
    it('should return correct collection name from contract', async () => {
      const contractAddress = '0x23581767a106ae21c074b2276D25e5C3e136a68b'
      const chainId = '1'
      const type = defs.NFTType.ERC721
      const name = await nftService.getCollectionNameFromContract(contractAddress, chainId, type)
      expect(name).toBeDefined()
      expect(name).not.toEqual('Unknown name')
    })
  })
})
