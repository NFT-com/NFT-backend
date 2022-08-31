import { ethers } from 'ethers'
import { Connection } from 'typeorm'

import { testDBConfig } from '@nftcom/gql/config'
import * as nftService from '@nftcom/gql/service/nft.service'
import { defs, typechain } from '@nftcom/shared/'
import { db } from '@nftcom/shared/db'
import { EdgeType, EntityType } from '@nftcom/shared/defs'

import {
  nftTestErrorMockData,
  nftTestMockData,
  testMockProfiles,
  testMockUser,
  testMockWallet,
} from '../util/constants'
import { clearDB } from '../util/helpers'
import { getTestApolloServer } from '../util/testApolloServer'

jest.setTimeout(300000)
jest.retryTimes(2)

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

jest.mock('@nftcom/gql/service/cache.service', () => ({
  cache: {
    get: jest.fn(),
    set: jest.fn(),
  },
  CacheKeys: {
    ASSOCIATED_ADDRESSES: 'associated_addresses',
    UPDATE_NFT_FOR_ASSOCIATED_WALLET: 'update_nft_for_associated_wallet',
  },
  createCacheConnection: jest.fn(),
}))

let testServer
const repositories = db.newRepositories()
let connection: Connection
let profile
let nft

const mockTestServer = (): any => {
  const mockArgs ={
    contract: nftTestMockData.contract,
    tokenId: nftTestMockData.tokenId,
    chainId: nftTestMockData.chainId,
  }
  testServer = getTestApolloServer({
    nft: {
      findById: (id) => {
        if (id === nftTestMockData.id) {
          return Promise.resolve({
            id,
            contract: mockArgs.contract,
            tokenId: mockArgs.tokenId,
            profileId: testMockProfiles.id,
          })
        }
        return null
      },
      findOne: ({ where: mockArgs }) => Promise.resolve({
        contract: mockArgs.contract,
        tokenId: mockArgs.tokenId,
        chainId: mockArgs.chainId,
      }),
    },
    profile: {
      findById: (id) => {
        if (id === testMockProfiles.id) {
          return Promise.resolve({
            id,
            url: testMockProfiles.url,
          })
        }
        return null
      },
    },
  },
  )
}

describe('nft resolver', () => {
  beforeAll(async () => {
    connection = await db.connectTestDB(testDBConfig)
  })

  afterAll(async () => {
    if (!connection) return
    await connection.close()
  })

  describe('get NFT', () => {
    beforeAll(async () => {
      mockTestServer()
    })
    afterAll(async () => {
      jest.clearAllMocks()
      await testServer.stop()
    })
    // get NFT
    it('should get NFT', async () => {
      const result = await testServer.executeOperation({
        query: `query Nft($contract: Address!, $nftId: String!, $chainId: String!) {
                nft(contract: $contract, id: $nftId, chainId: $chainId) {
                  tokenId
                  contract
                  chainId
                }
              }`,
        variables: {
          contract: nftTestMockData.contract,
          nftId: nftTestMockData.tokenId,
          chainId: nftTestMockData.chainId,
        },
      })
      expect(result?.data?.nft?.contract).toBe(nftTestMockData.contract)
      expect(result?.data?.nft?.tokenId).toBe(nftTestMockData.tokenId)
    })

    // invalid address
    it('should throw contract INVALID ADDRESS', async () => {
      const result = await testServer.executeOperation({
        query: `query Nft($contract: Address!, $nftId: String!, $chainId: String!) {
                nft(contract: $contract, id: $nftId, chainId: $chainId) {
                  tokenId
                  contract
                  chainId
                }
              }`,
        variables: {
          contract: nftTestErrorMockData.contract,
          nftId: nftTestMockData.tokenId,
          chainId: nftTestMockData.chainId,
        },
      })
      expect(result?.errors).toHaveLength(1)
    })

    // correct address, incorrect token
    it('should throw an error', async () => {
      const result = await testServer.executeOperation({
        query: `query Nft($contract: Address!, $nftId: String!, $chainId: String!) {
                nft(contract: $contract, id: $nftId, chainId: $chainId) {
                  tokenId
                  contract
                  id
                  chainId
                }
              }`,
        variables: {
          contract: nftTestMockData.contract,
          nftId: nftTestErrorMockData.tokenId,
          chainId: nftTestMockData.chainId,
        },
      })
      expect(result?.errors).toHaveLength(1)
    })
  })

  describe('get NFT By Id', () => {
    beforeAll(async () => {
      mockTestServer()
    })

    afterAll(async () => {
      jest.clearAllMocks()
      await testServer.stop()
    })

    // get NFT By Id
    it('should get NFT By Id', async () => {
      const result = await testServer.executeOperation({
        query: `query NftById($nftByIdId: ID!) {
          nftById(id: $nftByIdId) {
            id
            preferredProfile {
              url
            }
          }
        }`,
        variables: {
          nftByIdId: nftTestMockData.id,
        },
      })
      expect(result?.data?.nftById?.id).toBe(nftTestMockData.id)
      expect(result.data.nftById.preferredProfile.url).toBe(testMockProfiles.url)
    })

    // error
    it('should throw an error', async () => {
      const result = await testServer.executeOperation({
        query: `query NftById($nftByIdId: ID!) {
          nftById(id: $nftByIdId) {
            id
          }
        }`,
        variables: {
          nftByIdId: 'abcd',
        },
      })
      expect(result?.errors).toHaveLength(1)
    })
  })

  describe('updateAssociatedAddresses', () => {
    beforeAll(async () => {
      testMockUser.chainId = '5'
      testMockWallet.chainId = '5'
      testMockWallet.chainName = 'goerli'

      testServer = getTestApolloServer(repositories,
        testMockUser,
        testMockWallet,
        { id: '5', name: 'goerli' },
      )

      const wallet = await repositories.wallet.save({
        userId: 'test-user-id',
        chainId: '5',
        chainName: 'goerli',
        network: 'ethereum',
        address: '0x59495589849423692778a8c5aaCA62CA80f875a4',
      })

      profile = await repositories.profile.save({
        url: 'gk',
        ownerUserId: 'test-user-id',
        ownerWalletId: wallet.id,
        tokenId: '0',
        status: defs.ProfileStatus.Owned,
        gkIconVisible: false,
        layoutType: defs.ProfileLayoutType.Default,
        chainId: '5',
      })
    })

    afterAll(async () => {
      await clearDB(repositories)
      await testServer.stop()
    })

    it('should refresh NFTs for associated addresses', async () => {
      const result = await testServer.executeOperation({
        query: 'mutation UpdateAssociatedAddresses($input: UpdateAssociatedAddressesInput) { updateAssociatedAddresses(input: $input) { message } }',
        variables: {
          input: {
            profileUrl: 'gk',
            chainId: '5',
          },
        },
      })

      expect(result.data.updateAssociatedAddresses.message).toBeDefined()
      expect(result.data.updateAssociatedAddresses.message).toEqual('refreshed NFTs for associated addresses of gk')
      const nftEdges = await repositories.edge.find({
        where: {
          thisEntityType: defs.EntityType.Profile,
          thisEntityId: profile.id,
          thatEntityType: defs.EntityType.NFT,
          edgeType: defs.EdgeType.Displays,
        },
      })
      expect(nftEdges.length).toBeGreaterThan(0)
      const collectionEdges = await repositories.edge.find({
        where: {
          thisEntityType: defs.EntityType.Collection,
          edgeType: defs.EdgeType.Includes,
        },
      })
      expect(collectionEdges.length).toBeGreaterThan(0)
      const nfts = await repositories.nft.findAll()
      expect(nfts.length).toBeGreaterThan(0)
    })
  })

  describe('updateAssociatedContract', () => {
    beforeAll(async () => {
      testMockUser.chainId = '5'
      testMockWallet.chainId = '5'
      testMockWallet.chainName = 'goerli'

      testServer = getTestApolloServer(repositories,
        testMockUser,
        testMockWallet,
        { id: '5', name: 'goerli' },
      )

      const wallet = await repositories.wallet.save({
        userId: 'test-user-id',
        chainId: '5',
        chainName: 'goerli',
        network: 'ethereum',
        address: '0x1958Af77c06faB96D63351cACf10ABd3f598873B',
      })

      profile = await repositories.profile.save({
        url: '1',
        ownerUserId: 'test-user-id',
        ownerWalletId: wallet.id,
        tokenId: '0',
        status: defs.ProfileStatus.Owned,
        gkIconVisible: false,
        layoutType: defs.ProfileLayoutType.Default,
        chainId: '5',
      })
    })

    afterAll(async () => {
      await clearDB(repositories)
      await testServer.stop()
    })

    it('should update associated contract', async () => {
      const result = await testServer.executeOperation({
        query: 'mutation UpdateAssociatedContract($input: UpdateAssociatedContractInput) { updateAssociatedContract(input: $input) { message } }',
        variables: {
          input: {
            profileUrl: '1',
            chainId: '5',
          },
        },
      })

      expect(result.data.updateAssociatedContract.message).toEqual('Updated associated contract for 1')
      const collections = await repositories.collection.findAll()
      expect(collections.length).toBeGreaterThan(0)
    })
  })

  describe('updateNFTMemo', () => {
    beforeAll(async () => {
      testMockUser.chainId = '5'
      testMockWallet.chainId = '5'
      testMockWallet.chainName = 'goerli'

      testServer = getTestApolloServer(repositories,
        testMockUser,
        testMockWallet,
        { id: '5', name: 'goerli' },
      )

      nft = await repositories.nft.save({
        contract: '0xe0060010c2c81A817f4c52A9263d4Ce5c5B66D55',
        tokenId: '0x09c5',
        metadata: {
          name: '',
          description: '',
          traits: [],
        },
        type: defs.NFTType.ERC721,
        userId: 'test-user-id',
        walletId: 'test-wallet-id',
        chainId: '5',
      })
    })

    afterAll(async () => {
      await clearDB(repositories)
      await testServer.stop()
    })

    it('should update memo', async () => {
      const result = await testServer.executeOperation({
        query: 'mutation UpdateNFTMemo($nftId: ID!, $memo: String!) { updateNFTMemo(nftId: $nftId, memo: $memo) { memo } }',
        variables: {
          nftId: nft.id,
          memo: 'This is test memo',
        },
      })

      expect(result.data.updateNFTMemo.memo).toBeDefined()
      expect(result.data.updateNFTMemo.memo).toEqual('This is test memo')
    })
  })

  describe('myNFTs', () => {
    let profileA
    let nftA, nftB

    beforeAll(async () => {
      testMockUser.chainId = '5'
      testMockWallet.chainId = '5'
      testMockWallet.chainName = 'goerli'

      testServer = getTestApolloServer(repositories,
        testMockUser,
        testMockWallet,
        { id: '5', name: 'goerli' },
      )

      await repositories.collection.save({
        contract: ethers.utils.getAddress('0x9Ef7A34dcCc32065802B1358129a226B228daB4E'),
        name: 'NFT.com Profile',
        chainId: '5',
      })
      await repositories.collection.save({
        contract: ethers.utils.getAddress('0xe0060010c2c81A817f4c52A9263d4Ce5c5B66D55'),
        name: 'NFT.com Genesis Key',
        chainId: '5',
      })

      profileA = await repositories.profile.save({
        url: 'test-profile-url',
        ownerUserId: 'test-user-id',
      })
      nftA = await repositories.nft.save({
        contract: '0xe0060010c2c81A817f4c52A9263d4Ce5c5B66D55',
        tokenId: '0x09c5',
        metadata: {
          name: '',
          description: '',
          traits: [],
        },
        type: defs.NFTType.ERC721,
        userId: 'test-user-id',
        walletId: 'test-wallet-id',
        chainId: '5',
      })
      nftB = await repositories.nft.save({
        contract: '0x9Ef7A34dcCc32065802B1358129a226B228daB4E',
        tokenId: '0x01',
        metadata: {
          name: '',
          description: '',
          traits: [],
        },
        type: defs.NFTType.ERC721,
        userId: 'test-user-id',
        walletId: 'test-wallet-id',
        chainId: '5',
      })
      await repositories.edge.save({
        thisEntityId: profileA.id,
        thisEntityType: defs.EntityType.Profile,
        thatEntityId: nftA.id,
        thatEntityType: defs.EntityType.NFT,
        edgeType: defs.EdgeType.Displays,
        weight: 'aaaa',
        hide: false,
      })
      await repositories.edge.save({
        thisEntityId: profileA.id,
        thisEntityType: defs.EntityType.Profile,
        thatEntityId: nftB.id,
        thatEntityType: defs.EntityType.NFT,
        edgeType: defs.EdgeType.Displays,
        weight: 'aaab',
        hide: true,
      })
    })

    afterAll(async () => {
      await clearDB(repositories)
      await testServer.stop()
    })

    it('should return NFTs of profile', async () => {
      const result = await testServer.executeOperation({
        query: 'query MyNFTs($input: NFTsInput) { myNFTs(input: $input) { items { id } } }',
        variables: {
          input: {
            profileId: profileA.id,
            pageInput: {
              first: 100,
            },
          },
        },
      })

      expect(result.data.myNFTs).toBeDefined()
      expect(result.data.myNFTs.items.length).toEqual(2)
    })
  })

  describe('nftsForCollections', () => {
    let profileA

    beforeAll(async () => {
      testMockUser.chainId = '5'
      testMockWallet.chainId = '5'
      testMockWallet.chainName = 'goerli'

      testServer = getTestApolloServer(repositories,
        testMockUser,
        testMockWallet,
        { id: '5', name: 'goerli' },
      )

      const collection = await repositories.collection.save({
        contract: '0xe0060010c2c81A817f4c52A9263d4Ce5c5B66D55',
        name: 'NFT.com Genesis Key',
        chainId: '5',
      })

      profileA = await repositories.profile.save({
        url: 'test-profile',
      })

      const nftA = await repositories.nft.save({
        contract: '0xe0060010c2c81A817f4c52A9263d4Ce5c5B66D55',
        tokenId: '0x09c5',
        metadata: {
          name: '',
          description: '',
          traits: [],
        },
        type: defs.NFTType.ERC721,
        userId: 'test-user-id',
        walletId: 'test-wallet-id',
        chainId: '5',
        profileId: profileA.id,
      })

      await repositories.edge.save({
        thisEntityId: collection.id,
        thisEntityType: defs.EntityType.Collection,
        thatEntityId: nftA.id,
        thatEntityType: defs.EntityType.NFT,
        edgeType: defs.EdgeType.Includes,
      })
    })

    afterAll(async () => {
      await clearDB(repositories)
      await testServer.stop()
    })

    it('should return nfts for collections', async () => {
      const result = await testServer.executeOperation({
        query: 'query NftsForCollections($input: NftsForCollectionsInput!) { nftsForCollections(input: $input) { collectionAddress nfts { id contract profileId preferredProfile { url } } } }',
        variables: {
          input: {
            collectionAddresses: ['0xe0060010c2c81A817f4c52A9263d4Ce5c5B66D55'],
            count: 10,
            chainId: '5',
          },
        },
      })

      expect(result.data.nftsForCollections).toBeDefined()
      expect(result.data.nftsForCollections.length).toBeGreaterThan(0)
      expect(result.data.nftsForCollections[0].collectionAddress).toEqual('0xe0060010c2c81A817f4c52A9263d4Ce5c5B66D55')
      expect(result.data.nftsForCollections[0].nfts.length).toBeGreaterThan(0)
      expect(result.data.nftsForCollections[0].nfts[0].profileId).toBe(profileA.id)
      expect(result.data.nftsForCollections[0].nfts[0].preferredProfile.url).toBe('test-profile')
    })
  })

  describe('updateNFTProfileId', () => {
    let profileA
    let nftA
    beforeAll(async () => {
      testServer = getTestApolloServer(repositories,
        testMockUser,
        testMockWallet,
        { id: '5', name: 'goerli' },
      )
    })

    beforeEach(async () => {
      testMockUser.chainId = '5'
      testMockWallet.chainId = '5'
      testMockWallet.chainName = 'goerli'

      profileA = await repositories.profile.save({
        url: 'test-profile',
        ownerWalletId: testMockWallet.id,
      })

      nftA = await repositories.nft.save({
        contract: '0xe0060010c2c81A817f4c52A9263d4Ce5c5B66D55',
        tokenId: '0x09c5',
        metadata: {
          name: '',
          description: '',
          traits: [],
        },
        type: defs.NFTType.ERC721,
        userId: testMockUser.id,
        walletId: testMockWallet.id,
        chainId: '5',
      })
    })

    afterAll(async () => {
      await testServer.stop()
    })

    afterEach(async () => {
      await clearDB(repositories)
    })
    it('should insert the profile ID of a profile owned by the user', async () => {
      const result = await testServer.executeOperation({
        query: 'mutation UpdateNFTProfileId($nftId: ID!, $profileId: ID!) { updateNFTProfileId(nftId: $nftId, profileId: $profileId) { profileId } }',
        variables: {
          nftId: nftA.id,
          profileId: profileA.id,
        },
      })

      expect(result.data.updateNFTProfileId.profileId).toBe(profileA.id)
    })

    it('should not update profile ID if NFT not owned by the user', async () => {
      await repositories.nft.updateOneById(nftA.id, {
        walletId: 'something-else',
      })

      const result = await testServer.executeOperation({
        query: 'mutation UpdateNFTProfileId($nftId: ID!, $profileId: ID!) { updateNFTProfileId(nftId: $nftId, profileId: $profileId) { profileId } }',
        variables: {
          nftId: nftA.id,
          profileId: profileA.id,
        },
      })

      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].statusCode).toBe('403')
      expect(result.errors[0].message).toBe('NFT not owned by user')
    })

    it('should not update profile ID if profile not owned by the user', async () => {
      await repositories.profile.updateOneById(profileA.id, {
        ownerWalletId: 'something-different',
      })

      const result = await testServer.executeOperation({
        query: 'mutation UpdateNFTProfileId($nftId: ID!, $profileId: ID!) { updateNFTProfileId(nftId: $nftId, profileId: $profileId) { profileId } }',
        variables: {
          nftId: nftA.id,
          profileId: profileA.id,
        },
      })

      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].statusCode).toBe('403')
      expect(result.errors[0].message).toBe(`You cannot update profile ${profileA.id} because you do not own it`)
    })

    it('should return an error if NFT is not found', async () => {
      const result = await testServer.executeOperation({
        query: 'mutation UpdateNFTProfileId($nftId: ID!, $profileId: ID!) { updateNFTProfileId(nftId: $nftId, profileId: $profileId) { profileId } }',
        variables: {
          nftId: 'not-an-nft-id',
          profileId: profileA.id,
        },
      })

      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].statusCode).toBe('404')
      expect(result.errors[0].message).toBe('NFT not-an-nft-id not found')
    })

    it('should return an error if profile is not found', async () => {
      const result = await testServer.executeOperation({
        query: 'mutation UpdateNFTProfileId($nftId: ID!, $profileId: ID!) { updateNFTProfileId(nftId: $nftId, profileId: $profileId) { profileId } }',
        variables: {
          nftId: nftA.id,
          profileId: 'not-a-profile-id',
        },
      })

      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].statusCode).toBe('404')
      expect(result.errors[0].message).toBe('Profile not-a-profile-id not found')
    })
  })

  describe('updateNFTsForProfile', () => {
    let profileA
    let nftA
    beforeAll(async () => {
      testServer = getTestApolloServer(repositories,
        testMockUser,
        testMockWallet,
        { id: '5', name: 'goerli' },
      )
    })

    beforeEach(async () => {
      testMockUser.chainId = '5'
      testMockWallet.chainId = '5'
      testMockWallet.chainName = 'goerli'

      profileA = await repositories.profile.save({
        url: 'test-profile',
        ownerUserId: testMockUser.id,
        ownerWalletId: testMockWallet.id,
        chainId: '5',
      })

      nftA = await repositories.nft.save({
        contract: nftTestMockData.contract,
        tokenId: nftTestMockData.tokenId,
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
    })

    afterAll(async () => {
      await testServer.stop()
    })

    afterEach(async () => {
      await clearDB(repositories)
    })

    it('should reset profile ID if NFT not owned by the user', async () => {
      await repositories.wallet.save({
        ...testMockWallet,
        userId: testMockUser.id,
        createdAt: undefined,
      })
      await repositories.edge.save({
        thatEntityId: nftA.id,
        thatEntityType: EntityType.NFT,
        thisEntityId: profileA.id,
        thisEntityType: EntityType.Profile,
        edgeType: EdgeType.Displays,
      })

      const alchemySpy = jest.spyOn(nftService, 'getNFTsFromAlchemy')
      alchemySpy.mockResolvedValue([])
      typechain.NftResolver__factory.connect = jest.fn().mockReturnValue({
        associatedAddresses: jest.fn().mockResolvedValue([]),
      })

      const result = await testServer.executeOperation({
        query: 'mutation UpdateNFTsForProfile($input: UpdateNFTsForProfileInput) { updateNFTsForProfile(input: $input) { items { profileId } } }',
        variables: {
          input: {
            profileId: profileA.id,
            chainId: profileA.chainId,
            pageInput: {
              first: 1,
            },
          },
        },
      })

      // This expectation sucks, but jest spies for repository.edge.hardDelete
      // and repository.nft.hardDelete are being evaluated before the code is
      // reached. It's likely because of how the promises are structured...
      expect(result.data.updateNFTsForProfile.items).toHaveLength(0)
    })
  })

  describe('uploadMetadataImagesToS3', () => {
    beforeAll(async () => {
      testMockUser.chainId = '5'
      testMockWallet.chainId = '5'
      testMockWallet.chainName = 'goerli'
      testServer = getTestApolloServer(repositories,
        testMockUser,
        testMockWallet,
        { id: '5', name: 'goerli' },
      )

      await repositories.nft.save({
        contract: nftTestMockData.contract,
        tokenId: nftTestMockData.tokenId,
        chainId: '5',
        metadata: {
          name: '',
          description: '',
          imageURL: 'https://lh3.googleusercontent.com/XnVDILmz1xpvGkQ38XMh_W-yV_32JztFZVX3xIAt9HIqSnwOgbcqIT_fj-zP8uFbsMVmprFdCGarDl-9IhLKD9FwkFlceaVHpYa5',
          traits: [],
        },
        type: defs.NFTType.ERC721,
        userId: testMockUser.id,
        walletId: testMockWallet.id,
      })

      await repositories.nft.save({
        contract: '0xD1E5b0FF1287aA9f9A268759062E4Ab08b9Dacbe',
        tokenId: nftTestMockData.tokenId,
        chainId: '5',
        metadata: {
          name: '',
          description: '',
          imageURL: 'ipfs://QmYQdCpm5JWBuodHUsNVqhGng1NBt9DBn91QZSMV7B9D2g/4.png',
          traits: [],
        },
        type: defs.NFTType.ERC721,
        userId: testMockUser.id,
        walletId: testMockWallet.id,
      })

      await repositories.nft.save({
        contract: '0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85',
        tokenId: nftTestMockData.tokenId,
        chainId: '5',
        metadata: {
          name: '',
          description: '',
          imageURL: 'https://etherheads.mypinata.cloud/ipfs/QmVMETREsj6gML5CL8ozNAcNyom9Qkp2W5iqC8cDbVxu6j/429.png',
          traits: [],
        },
        type: defs.NFTType.ERC721,
        userId: testMockUser.id,
        walletId: testMockWallet.id,
      })

      await repositories.nft.save({
        contract: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
        tokenId: nftTestMockData.tokenId,
        chainId: '5',
        metadata: {
          name: '',
          description: '',
          imageURL: 'https://metadata.ens.domains/mainnet/0x57f1887a8bf19b14fc0df6fd9b2acc9af147ea85/0xe4a8957929d1acdb9a8532ecf39922292e280337dd6db3c1b1500288e38a67f5/image',
          traits: [],
        },
        type: defs.NFTType.ERC721,
        userId: testMockUser.id,
        walletId: testMockWallet.id,
      })

      await repositories.nft.save({
        contract: '0xbFF8194280133EA979aAF16D1A7BDd004493ABE5',
        tokenId: nftTestMockData.tokenId,
        chainId: '5',
        metadata: {
          name: '',
          description: '',
          imageURL: 'https://decentralizeddevs.mypinata.cloud/ipfs/QmVEz1ZjB259xad4JCUeQcYppAzsZv7ahgUXmR41B8suck/908.gif',
          traits: [],
        },
        type: defs.NFTType.ERC721,
        userId: testMockUser.id,
        walletId: testMockWallet.id,
      })
    })

    afterAll(async () => {
      await clearDB(repositories)
      await testServer.stop()
    })

    it('should update previewLink of NFTs', async () => {
      const result = await testServer.executeOperation({
        query: 'mutation UploadMetadataImagesToS3($count: Int!) { uploadMetadataImagesToS3(count:$count) {  message } }',
        variables: {
          count: 100,
        },
      })

      expect(result.data.uploadMetadataImagesToS3.message).toEqual('Saved preview link of metadata image for 5 NFTs')
      const nfts = await repositories.nft.findAll()
      expect(nfts.length).toEqual(5)
      for (nft of nfts) {
        expect(nft.previewLink).toBeDefined()
      }
    })
  })
})
