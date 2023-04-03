import { ethers } from 'ethers'

import { testDBConfig } from '@nftcom/gql/config'
import { NFTType } from '@nftcom/gql/defs/gql'
import * as nftService from '@nftcom/gql/service/nft.service'
import { getCollectionInfo, getOwnersForNFT, updateNFTMetadata } from '@nftcom/gql/service/nft.service'
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
        indexNFTs: jest.fn().mockResolvedValue(true),
      }
    }),
  }
})

jest.mock('@nftcom/cache', () => ({
  redisConfig: {},
  cache: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  },
  CacheKeys: {
    PROFILE_SORTED_NFTS: 'PROFILE_SORTED_NFTS',
    PROFILE_SORTED_VISIBLE_NFTS: 'PROFILE_SORTED_VISIBLE_NFTS',
    GENESIS_KEY_OWNERS: 'genesis_key_owners',
  },
  createCacheConnection: jest.fn(),
}))

const repositories = db.newRepositories()

let connection
let testServer
let nftA, nftB, nftC
let user, wallet, wallet2

describe('nft service', () => {
  beforeAll(async () => {
    connection = await db.connectTestDB(testDBConfig)
    await db.connectTestPg()
  })

  afterAll(async () => {
    if (!connection) return
    await connection.destroy()
    await db.endPg()
  })

  describe('refresh nft endpoint', () => {
    beforeEach(async () => {
      testServer = getTestApolloServer({
        nft: {
          findById: (id: any) =>
            Promise.resolve({
              id,
              walletId: 'test-wallet-id',
              userId: 'test-user-id',
            }),
        },
        wallet: {
          findById: (id: any) =>
            Promise.resolve({
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
        variables: {},
      })

      expect(result.errors).toHaveLength(1)
      expect(spy).not.toHaveBeenCalled()
    })
  })

  describe('getCollectionInfo', () => {
    beforeAll(async () => {
      await repositories.collection.save({
        contract: ethers.utils.getAddress('0xAd8C3BDd635e33e14DFC020fCd922Ef89aA9Bf6E'),
        name: 'Warner Bros nft',
        chainId: '1',
        deployer: ethers.utils.getAddress('0x87686E35CEF5271E33e83e1294FDd633a807eeEA'),
        isOfficial: true,
        slug: 'warner-bros-nft',
      })
      await repositories.collection.save({
        contract: ethers.utils.getAddress('0x8fB5a7894AB461a59ACdfab8918335768e411414'),
        name: 'NFT.com Genesis Key',
        chainId: '1',
        deployer: ethers.utils.getAddress('0x487F09bD7554e66f131e24edC1EfEe0e0Dfa7fD1'),
        slug: 'nft-com-genesis-key',
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
    it('should return collection, when queried by slug', async () => {
      const chainId = '1'
      const slug = 'warner-bros-nft'
      const collectionInfo = await getCollectionInfo({
        chainId,
        slug,
        repositories,
      })
      expect(collectionInfo.collection.slug).toEqual(slug)
      expect(collectionInfo.collection.description).not.toEqual(null)
    })
    it('should return default banner, logo image and description', async () => {
      const contract = '0xAd8C3BDd635e33e14DFC020fCd922Ef89aA9Bf6E'
      const chainId = '1'

      const collectionInfo = await getCollectionInfo({
        chainId,
        contract,
        repositories,
      })
      expect(collectionInfo.collection.bannerUrl).toEqual('https://cdn.nft.com/collectionBanner_default.png')
      expect(collectionInfo.collection.logoUrl).toEqual('https://cdn.nft.com/profile-image-default.svg')
      expect(collectionInfo.collection.description).not.toEqual(null)
    })
    it('should return valid banner, logo image and description', async () => {
      const contract = '0x8fB5a7894AB461a59ACdfab8918335768e411414'
      const chainId = '1'
      const collectionInfo = await getCollectionInfo({
        chainId,
        contract,
        repositories,
      })
      expect(collectionInfo.collection.bannerUrl).not.toEqual('https://cdn.nft.com/collectionBanner_default.png')
      expect(collectionInfo.collection.logoUrl).not.toEqual('https://cdn.nft.com/profile-image-default.svg')
      expect(collectionInfo.collection.description).not.toEqual(null)
    })
  })

  describe('updateENSNFTMedata', () => {
    beforeAll(async () => {
      nftA = await repositories.nft.save({
        contract: '0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85',
        tokenId: '0xd29ed6005bb7617a915b12cc03fbe7f5a2a9b1eaad86be52293436ed3b6379a5',
        chainId: '5',
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

  describe('updateNFTOwnershipAndMetadata', () => {
    beforeAll(async () => {
      const testUser = await repositories.user.save({
        username: 'ethereum-0xf5de760f2e916647fd766B4AD9E85ff943cE3A2b',
        referralId: 'test.referral.id',
      })

      const testWallet = await repositories.wallet.save({
        address: '0xf5de760f2e916647fd766B4AD9E85ff943cE3A2b',
        network: 'ethereum',
        chainId: '5',
        chainName: 'goerli',
        userId: testUser.id,
      })

      const profile = await repositories.profile.save({
        url: 'testprofile1',
        ownerUserId: testUser.id,
        ownerWalletId: testWallet.id,
        tokenId: '34',
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
        userId: testUser.id,
        walletId: testWallet.id,
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

      wallet2 = await repositories.wallet.save({
        address: '0x0d23B68cD7fBc3afA097f14ba047Ca2C1da64349',
        network: 'ethereum',
        chainId: '1',
        chainName: 'mainet',
        userId: user.id,
      })

      nftB = await repositories.nft.save({
        contract: '0x06012c8cf97BEaD5deAe237070F9587f8E7A266d',
        tokenId: '0x024a39',
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

      nftC = await repositories.nft.save({
        contract: '0xe21EBCD28d37A67757B9Bc7b290f4C4928A430b1',
        tokenId: '0x12fe',
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

    it('should remove edge of profile for previous owner', async () => {
      const nft = {
        contract: {
          address: '0x9Ef7A34dcCc32065802B1358129a226B228daB4E',
        },
        description: 'descriptive text',
        metadata: {
          image: 'ipfs://imageurl',
          attributes: [
            {
              trait_type: 'dummy',
              value: 'value',
            },
          ],
        },
        id: {
          tokenId: '0x22',
          tokenMetadata: {
            tokenType: 'ERC721',
          },
        },
      }
      nftService.initiateWeb3('5')
      await nftService.updateNFTOwnershipAndMetadata(nft, user.id, wallet, '5')

      // Previous edges should be removed
      const edges = await repositories.edge.findAll()
      expect(edges.length).toEqual(0)
    })

    it('should update NFT metadata with traits', async () => {
      const nft = {
        contract: {
          address: '0x06012c8cf97BEaD5deAe237070F9587f8E7A266d',
        },
        description: 'descriptive text',
        metadata: {
          image: 'ipfs://imageurl',
          attributes: [
            {
              trait_type: 'dummy',
              value: 'value',
            },
          ],
        },
        id: {
          tokenId: '0x024a39',
          tokenMetadata: {
            tokenType: 'ERC721',
          },
        },
      }
      nftService.initiateWeb3('1')
      await nftService.updateNFTOwnershipAndMetadata(nft, user.id, wallet, '1')

      const updatedNFT = await repositories.nft.findById(nftB.id)
      expect(updatedNFT.metadata.imageURL.length).toBeGreaterThan(0)
      expect(updatedNFT.metadata.traits.length).toBeGreaterThan(0)
    })

    it('should update NFT imageURL of metadata with base64 string', async () => {
      const nft = {
        contract: {
          address: '0xe21EBCD28d37A67757B9Bc7b290f4C4928A430b1',
        },
        description: 'descriptive text',
        metadata: {
          image_data:
            'data:image/png;base64, iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==',
          attributes: [
            {
              trait_type: 'dummy',
              value: 'value',
            },
          ],
        },
        id: {
          tokenId: '0x12fe',
          tokenMetadata: {
            tokenType: 'ERC721',
          },
        },
      }
      nftService.initiateWeb3('1')
      await nftService.updateNFTOwnershipAndMetadata(nft, user.id, wallet2, '1')

      const updatedNFT = await repositories.nft.findById(nftC.id)
      expect(updatedNFT.metadata.imageURL.length).toBeGreaterThan(0)
    })
  })

  describe('getCollectionNameFromContract', () => {
    it('should return correct collection name from ERC721 contract', async () => {
      const contractAddress = '0x23581767a106ae21c074b2276D25e5C3e136a68b'
      const chainId = '1'
      const type = defs.NFTType.ERC721
      const name = await nftService.getCollectionNameFromContract(contractAddress, chainId, type)
      expect(name).toBeDefined()
      expect(name).not.toEqual('Unknown Name')
    })

    it('should return correct collection name from ERC1155 contract', async () => {
      const contractAddress = '0xdDd6754c22ffAC44980342173fa956Bc7DDa018e'
      const chainId = '1'
      const type = defs.NFTType.ERC1155
      const name = await nftService.getCollectionNameFromContract(contractAddress, chainId, type)
      expect(name).toBeDefined()
      expect(name).not.toEqual('Unknown Name')
    })

    it('should return unknown name for wrong type', async () => {
      const contractAddress = '0x5D42e55014d20E97A25bC726D7eDF5FE9d95d70f'
      const chainId = '1'
      const type = defs.NFTType.GenesisKey
      const name = await nftService.getCollectionNameFromContract(contractAddress, chainId, type)
      expect(name).toEqual('Unknown Name')
    })
  })

  describe('getCollectionNameFromDataProvider', () => {
    it('should return correct collection name for ERC721 type', async () => {
      const contractAddress = '0x23581767a106ae21c074b2276D25e5C3e136a68b'
      const chainId = '1'
      const type = defs.NFTType.ERC721
      const name = await nftService.getCollectionNameFromDataProvider(contractAddress, chainId, type)
      expect(name).toBeDefined()
      expect(name).not.toEqual('Unknown Name')
    })

    it('should return correct collection name for ERC1155 type', async () => {
      const contractAddress = '0xdDd6754c22ffAC44980342173fa956Bc7DDa018e'
      const chainId = '1'
      const type = defs.NFTType.ERC1155
      const name = await nftService.getCollectionNameFromDataProvider(contractAddress, chainId, type)
      expect(name).toBeDefined()
      expect(name).not.toEqual('Unknown Name')
    })
  })

  describe('getUserWalletFromNFT', () => {
    it('should return undefined when getOwnersForNFT throws error', async () => {
      // wrong contract
      const contract = '0x76BE3b62873462d2142405439777e971754E8E76'
      const tokenId = '0x284b'
      const chainId = '1'
      const wallet = await nftService.getUserWalletFromNFT(contract, tokenId, chainId)
      expect(wallet).toBeUndefined()
    })
  })

  describe('getNFTsFromAlchemy', () => {
    it('should return NFTs from alchemy', async () => {
      const owner = '0x59495589849423692778a8c5aaca62ca80f875a4'
      nftService.initiateWeb3('5')
      const nfts = await nftService.getNFTsFromAlchemy(owner)
      expect(nfts.length).toBeGreaterThan(0)
    })
  })

  describe('refreshNFTMetadata', () => {
    beforeAll(async () => {
      nftA = await repositories.nft.save({
        contract: '0xe0060010c2c81A817f4c52A9263d4Ce5c5B66D55',
        tokenId: '0x01f3',
        chainId: '5',
        metadata: {
          name: 'test-nft',
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

    it('should refresh NFT metadata', async () => {
      nftService.initiateWeb3('5')
      const nftUpdated = await nftService.refreshNFTMetadata(nftA)
      expect(nftUpdated).toBeDefined()
      expect(nftUpdated.metadata.name.length).toBeGreaterThan(0)
      expect(nftUpdated.metadata.description.length).toBeGreaterThan(0)
      expect(nftUpdated.metadata.traits.length).toBeGreaterThan(0)
    })
  })

  describe('hideAllNFTs', () => {
    beforeAll(async () => {
      await repositories.edge.save({
        thisEntityType: defs.EntityType.Profile,
        thisEntityId: 'test-profile',
        edgeType: defs.EdgeType.Displays,
        thatEntityType: defs.EntityType.NFT,
        thatEntityId: 'test-nft',
        hide: false,
      })
      await repositories.edge.save({
        thisEntityType: defs.EntityType.Profile,
        thisEntityId: 'test-profile',
        edgeType: defs.EdgeType.Displays,
        thatEntityType: defs.EntityType.NFT,
        thatEntityId: 'test-nft-1',
        hide: false,
      })
    })

    afterAll(async () => {
      await clearDB(repositories)
    })

    it('should hide all NFTs', async () => {
      await nftService.hideAllNFTs(repositories, 'test-profile')
      const count = await repositories.edge.count({ hide: true })
      expect(count).toEqual(2)
    })
  })

  describe('showAllNFTs', () => {
    beforeAll(async () => {
      await repositories.nft.save({
        contract: '0xe0060010c2c81A817f4c52A9263d4Ce5c5B66D55',
        tokenId: '0x01f3',
        chainId: '5',
        metadata: {
          name: 'test-nft',
          description: '',
          traits: [],
        },
        type: defs.NFTType.ERC721,
        userId: testMockUser.id,
        walletId: testMockWallet.id,
      })
      await repositories.nft.save({
        contract: '0xe0060010c2c81A817f4c52A9263d4Ce5c5B66D55',
        tokenId: '0x02ea',
        chainId: '5',
        metadata: {
          name: 'test-nft-1',
          description: '',
          traits: [],
        },
        type: defs.NFTType.ERC721,
        userId: testMockUser.id,
        walletId: testMockWallet.id,
      })
      await repositories.edge.save({
        thisEntityType: defs.EntityType.Profile,
        thisEntityId: 'test-profile',
        edgeType: defs.EdgeType.Displays,
        thatEntityType: defs.EntityType.NFT,
        thatEntityId: 'test-nft-id',
        hide: true,
      })
    })

    afterAll(async () => {
      await clearDB(repositories)
    })

    it('should show all NFTs', async () => {
      await nftService.showAllNFTs(repositories, testMockWallet.id, 'test-profile', '5')
      const count = await repositories.edge.count({ hide: false })
      expect(count).toEqual(3)
    })
  })

  describe('showNFTs', () => {
    beforeAll(async () => {
      nftA = await repositories.nft.save({
        contract: '0xe0060010c2c81A817f4c52A9263d4Ce5c5B66D55',
        tokenId: '0x01f3',
        chainId: '5',
        metadata: {
          name: 'test-nft',
          description: '',
          traits: [],
        },
        type: defs.NFTType.ERC721,
        userId: testMockUser.id,
        walletId: testMockWallet.id,
      })
      nftB = await repositories.nft.save({
        contract: '0xe0060010c2c81A817f4c52A9263d4Ce5c5B66D55',
        tokenId: '0x02ea',
        chainId: '5',
        metadata: {
          name: 'test-nft-1',
          description: '',
          traits: [],
        },
        type: defs.NFTType.ERC721,
        userId: testMockUser.id,
        walletId: testMockWallet.id,
      })
      await repositories.edge.save({
        thisEntityType: defs.EntityType.Profile,
        thisEntityId: 'test-profile',
        edgeType: defs.EdgeType.Displays,
        thatEntityType: defs.EntityType.NFT,
        thatEntityId: nftA.id,
        hide: true,
      })
    })

    afterAll(async () => {
      await clearDB(repositories)
    })

    it('should show NFTs for specific IDs', async () => {
      await nftService.showNFTs([nftA.id], 'test-profile', '5')
      const count = await repositories.edge.count({ hide: false })
      expect(count).toEqual(1)
    })
  })

  describe('changeNFTsVisibility', () => {
    beforeEach(async () => {
      nftA = await repositories.nft.save({
        contract: '0xe0060010c2c81A817f4c52A9263d4Ce5c5B66D55',
        tokenId: '0x01f3',
        chainId: '5',
        metadata: {
          name: 'test-nft',
          description: '',
          traits: [],
        },
        type: defs.NFTType.ERC721,
        userId: testMockUser.id,
        walletId: testMockWallet.id,
      })
      nftB = await repositories.nft.save({
        contract: '0xe0060010c2c81A817f4c52A9263d4Ce5c5B66D55',
        tokenId: '0x02ea',
        chainId: '5',
        metadata: {
          name: 'test-nft-1',
          description: '',
          traits: [],
        },
        type: defs.NFTType.ERC721,
        userId: testMockUser.id,
        walletId: testMockWallet.id,
      })
      await repositories.edge.save({
        thisEntityType: defs.EntityType.Profile,
        thisEntityId: 'test-profile',
        edgeType: defs.EdgeType.Displays,
        thatEntityType: defs.EntityType.NFT,
        thatEntityId: nftA.id,
        hide: false,
      })
      await repositories.edge.save({
        thisEntityType: defs.EntityType.Profile,
        thisEntityId: 'test-profile',
        edgeType: defs.EdgeType.Displays,
        thatEntityType: defs.EntityType.NFT,
        thatEntityId: nftB.id,
        hide: false,
      })
    })

    afterEach(async () => {
      await clearDB(repositories)
    })

    it('should show all NFTs', async () => {
      await nftService.changeNFTsVisibility(
        repositories,
        testMockWallet.id,
        'test-profile',
        true,
        false,
        null,
        null,
        '5',
      )
      const count = await repositories.edge.count({ hide: false })
      expect(count).toEqual(2)
    })

    it('should hide all NFTs', async () => {
      await nftService.changeNFTsVisibility(
        repositories,
        testMockWallet.id,
        'test-profile',
        false,
        true,
        null,
        null,
        '5',
      )
      const count = await repositories.edge.count({ hide: true })
      expect(count).toEqual(2)
    })

    it('should hide NFTs for specific IDs', async () => {
      await nftService.changeNFTsVisibility(
        repositories,
        testMockWallet.id,
        'test-profile',
        false,
        false,
        null,
        [nftB.id],
        '5',
      )
      const count = await repositories.edge.count({ hide: true })
      expect(count).toEqual(1)
    })
  })

  describe('updateNFTsOrder', () => {
    beforeEach(async () => {
      nftA = await repositories.nft.save({
        contract: '0xe0060010c2c81A817f4c52A9263d4Ce5c5B66D55',
        tokenId: '0x01f3',
        chainId: '5',
        metadata: {
          name: 'test-nft',
          description: '',
          traits: [],
        },
        type: defs.NFTType.ERC721,
        userId: testMockUser.id,
        walletId: testMockWallet.id,
      })
      nftB = await repositories.nft.save({
        contract: '0xe0060010c2c81A817f4c52A9263d4Ce5c5B66D55',
        tokenId: '0x02ea',
        chainId: '5',
        metadata: {
          name: 'test-nft-1',
          description: '',
          traits: [],
        },
        type: defs.NFTType.ERC721,
        userId: testMockUser.id,
        walletId: testMockWallet.id,
      })
      await repositories.edge.save({
        thisEntityType: defs.EntityType.Profile,
        thisEntityId: 'test-profile',
        edgeType: defs.EdgeType.Displays,
        thatEntityType: defs.EntityType.NFT,
        thatEntityId: nftA.id,
        hide: false,
        weight: 'aaaa',
      })
      await repositories.edge.save({
        thisEntityType: defs.EntityType.Profile,
        thisEntityId: 'test-profile',
        edgeType: defs.EdgeType.Displays,
        thatEntityType: defs.EntityType.NFT,
        thatEntityId: nftB.id,
        hide: false,
        weight: 'aaab',
      })
    })

    afterEach(async () => {
      await clearDB(repositories)
    })

    it('should updateNFTs order to beginning', async () => {
      await nftService.updateNFTsOrder('test-profile', [
        {
          nftId: nftB.id,
          newIndex: 0,
        },
      ])
      const edge = await repositories.edge.findOne({
        where: {
          thisEntityType: defs.EntityType.Profile,
          thatEntityType: defs.EntityType.NFT,
          thisEntityId: 'test-profile',
          thatEntityId: nftB.id,
          edgeType: defs.EdgeType.Displays,
        },
      })
      expect(edge.weight).toEqual('aaaa')
    })

    it('should updateNFTs order to end', async () => {
      await nftService.updateNFTsOrder('test-profile', [
        {
          nftId: nftA.id,
          newIndex: 3,
        },
      ])
      const edge = await repositories.edge.findOne({
        where: {
          thisEntityType: defs.EntityType.Profile,
          thatEntityType: defs.EntityType.NFT,
          thisEntityId: 'test-profile',
          thatEntityId: nftA.id,
          edgeType: defs.EdgeType.Displays,
        },
      })
      expect(edge.weight).toEqual('aaac')
    })
  })

  describe('createEdgesForProfile', () => {
    beforeAll(async () => {
      nftA = await repositories.nft.save({
        contract: '0xe0060010c2c81A817f4c52A9263d4Ce5c5B66D55',
        tokenId: '0x01f3',
        chainId: '5',
        metadata: {
          name: 'test-nft',
          description: '',
          traits: [],
        },
        type: defs.NFTType.ERC721,
        userId: testMockUser.id,
        walletId: testMockWallet.id,
      })
      nftB = await repositories.nft.save({
        contract: '0xe0060010c2c81A817f4c52A9263d4Ce5c5B66D55',
        tokenId: '0x02ea',
        chainId: '5',
        metadata: {
          name: 'test-nft-1',
          description: '',
          traits: [],
        },
        type: defs.NFTType.ERC721,
        userId: testMockUser.id,
        walletId: testMockWallet.id,
      })
      await repositories.edge.save({
        thisEntityType: defs.EntityType.Profile,
        thisEntityId: 'test-profile',
        edgeType: defs.EdgeType.Displays,
        thatEntityType: defs.EntityType.NFT,
        thatEntityId: nftA.id,
        hide: false,
      })
      await repositories.edge.save({
        thisEntityType: defs.EntityType.Profile,
        thisEntityId: 'test-profile',
        edgeType: defs.EdgeType.Displays,
        thatEntityType: defs.EntityType.NFT,
        thatEntityId: nftB.id,
      })
    })

    afterAll(async () => {
      await clearDB(repositories)
    })

    it('should update edges with weight', async () => {
      await nftService.createEdgesForProfile('test-profile', testMockWallet.id)
      const edges = await repositories.edge.findAll()
      for (const edge of edges) {
        expect(edge.weight).toBeNull()
      }
    })
  })

  describe('getNFTsForCollection', () => {
    afterAll(async () => {
      await clearDB(repositories)
    })

    it('should get NFTs for cryptokitty', async () => {
      nftService.initiateWeb3('1')
      const nfts = await nftService.getNFTsForCollection('0x06012c8cf97BEaD5deAe237070F9587f8E7A266d')
      expect(nfts).toBeDefined()
      expect(nfts.length).toBeGreaterThan(0)
      for (const nft of nfts) {
        expect(nft.id.tokenId).toBeDefined()
      }
    })

    it('should get NFTs for cryptopunks', async () => {
      nftService.initiateWeb3('1')
      const nfts = await nftService.getNFTsForCollection('0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB')
      expect(nfts).toBeDefined()
      expect(nfts.length).toBeGreaterThan(0)
      for (const nft of nfts) {
        expect(nft.id.tokenId).toBeDefined()
      }
    })

    it('should get NFTs for mooncat', async () => {
      nftService.initiateWeb3('1')
      const nfts = await nftService.getNFTsForCollection('0xc3f733ca98E0daD0386979Eb96fb1722A1A05E69')
      expect(nfts).toBeDefined()
      expect(nfts.length).toBeGreaterThan(0)
      for (const nft of nfts) {
        expect(nft.id.tokenId).toBeDefined()
      }
    })

    it('should get NFTs for rare pepe', async () => {
      nftService.initiateWeb3('1')
      const nfts = await nftService.getNFTsForCollection('0x937a2cd137FE77dB397c51975b0CaAaa29559CF7')
      expect(nfts).toBeDefined()
      expect(nfts.length).toBeGreaterThan(0)
      for (const nft of nfts) {
        expect(nft.id.tokenId).toBeDefined()
      }
    })

    it('should get NFTs for ether rock', async () => {
      nftService.initiateWeb3('1')
      const nfts = await nftService.getNFTsForCollection('0xA3F5998047579334607c47a6a2889BF87A17Fc02')
      expect(nfts).toBeDefined()
      expect(nfts.length).toBeGreaterThan(0)
      for (const nft of nfts) {
        expect(nft.id.tokenId).toBeDefined()
      }
    })
  })

  describe('getNftType', () => {
    it('should get type for nftPort CRYPTOPUNKS by type', () => {
      const type = nftService.getNftType(undefined, { contract: { type: 'CRYPTO_PUNKS' } })
      expect(type).toBe(NFTType.CRYPTO_PUNKS)
    })

    it('should get type for nftPort CRYPTOPUNKS by contract address', () => {
      const type = nftService.getNftType(undefined, {
        nft: { contract_address: '0xb47e3cd837ddf8e4c57f05d70ab865de6e193bbb' },
      })
      expect(type).toBe(NFTType.CRYPTO_PUNKS)
    })

    it('should get type for alchemy ERC721', () => {
      const type = nftService.getNftType({ id: { tokenMetadata: { tokenType: 'ERC721' } } })
      expect(type).toBe(NFTType.ERC721)
    })

    it('should get type for nftPort ERC721', () => {
      const type = nftService.getNftType(undefined, { contract: { type: 'ERC721' } })
      expect(type).toBe(NFTType.ERC721)
    })

    it('should get type for alchemy ERC1155', () => {
      const type = nftService.getNftType({ id: { tokenMetadata: { tokenType: 'ERC1155' } } })
      expect(type).toBe(NFTType.ERC1155)
    })

    it('should get type for nftPort ERC1155', () => {
      const type = nftService.getNftType(undefined, { contract: { type: 'ERC1155' } })
      expect(type).toBe(NFTType.ERC1155)
    })

    it('should get type for alchemy UNKNOWN', () => {
      const type = nftService.getNftType({ title: 'anything.eth' })
      expect(type).toBe(NFTType.UNKNOWN)
    })

    it('should get type for nftPort UNKNOWN', () => {
      const type = nftService.getNftType(undefined, { nft: { metadata: { name: 'something.eth' } } })
      expect(type).toBe(NFTType.UNKNOWN)
    })

    it('should fail to undefined', () => {
      const type = nftService.getNftType(undefined, undefined)
      expect(type).toBeUndefined()
    })
  })
})
