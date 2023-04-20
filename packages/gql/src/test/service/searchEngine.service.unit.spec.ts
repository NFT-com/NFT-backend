import { searchEngineClient, searchEngineService } from '@nftcom/service'
import { entity } from '@nftcom/shared'

import { NullTypesenseClient } from '../__nulls__/NullTypesenseClient'

jest.mock('@nftcom/gql/service/nft.service')

describe('search engine service', () => {
  describe('indexNFT', () => {
    let nft, repos
    beforeAll(() => {
      nft = {
        id: 'CM4b_FXWRTcKav1EfZFDq',
        contract: '0xb1D65B1a259bEA89a5A790db9a4Be5B2FFF97319',
        tokenId: '0x0c',
        type: 'ERC721',
        metadata: {
          name: ' #12',
          description: '',
          traits: [],
        },
        walletId: 'KE-GvnbBXXjFjwokLr-lo',
        chainId: '5',
      } as entity.NFT

      repos = {
        nft: {
          findById: (_: string) => {
            return Promise.resolve(nft)
          },
        },
        collection: {
          findOne: (_: any) => {
            return Promise.resolve(new entity.Collection())
          },
        },
        txActivity: {
          findActivitiesForNFT: jest.fn(),
          findActivitiesForNFTs: jest.fn().mockResolvedValue([]),
        },
        wallet: {
          findById: (_: string) => {
            return Promise.resolve(new entity.Wallet())
          },
        },
      }
    })

    afterEach(() => {
      jest.clearAllMocks()
    })

    it('sends an NFT to the search engine', async () => {
      const seService = searchEngineService.SearchEngineService(
        searchEngineClient.SearchEngineClient.createNull(new NullTypesenseClient([{ success: true }])),
        repos,
      )

      const result = await seService.indexNFTs([nft])

      expect(result).toBe(true)
    })

    it('notifies of an unsuccessful import', async () => {
      const seService = searchEngineService.SearchEngineService(
        searchEngineClient.SearchEngineClient.createNull(new NullTypesenseClient([{ success: false }])),
        repos,
      )

      const result = await seService.indexNFTs([nft])

      expect(result).toBe(false)
    })
  })

  describe('deleteNFT', () => {
    let repos
    beforeAll(() => {
      repos = {}
    })

    afterEach(() => {
      jest.clearAllMocks()
    })

    it('calls the search engine client to remove the NFT document', async () => {
      const seService = searchEngineService.SearchEngineService(
        searchEngineClient.SearchEngineClient.createNull(new NullTypesenseClient([])),
        repos,
      )

      const result = await seService.deleteNFT('123456abc')

      expect(result).toBeTruthy()
    })
  })

  describe('indexCollections', () => {
    let repos
    beforeAll(() => {
      repos = {
        nft: {
          findOne: (_: any) => {
            return Promise.resolve({ type: 'ERC721' } as entity.NFT)
          },
        },
      }
    })

    afterEach(() => {
      jest.clearAllMocks()
    })

    it('sends collections to the search engine', async () => {
      const seService = searchEngineService.SearchEngineService(
        searchEngineClient.SearchEngineClient.createNull(
          new NullTypesenseClient([{ success: true }, { success: true }]),
        ),
        repos,
      )

      const collections = [
        { contract: '0xe0060010c2c81A817f4c52A9263d4Ce5c5B66D55' } as entity.Collection,
        { contract: '0x9Ef7A34dcCc32065802B1358129a226B228daB4E' } as entity.Collection,
      ]
      const result = await seService.indexCollections(collections)

      expect(result).toBe(true)
    })

    it('notifies of failed import', async () => {
      const seService = searchEngineService.SearchEngineService(
        searchEngineClient.SearchEngineClient.createNull(
          new NullTypesenseClient([{ success: false }, { success: true }]),
        ),
        repos,
      )

      const collections = [
        { contract: '0xe0060010c2c81A817f4c52A9263d4Ce5c5B66D55' } as entity.Collection,
        { contract: '0x9Ef7A34dcCc32065802B1358129a226B228daB4E' } as entity.Collection,
      ]
      const result = await seService.indexCollections(collections)

      expect(result).toBe(false)
    })
  })

  describe('deleteCollections', () => {
    let repos
    beforeAll(() => {
      repos = {}
    })

    afterEach(() => {
      jest.clearAllMocks()
    })

    it('calls the search engine client to remove the NFT document', async () => {
      const seService = searchEngineService.SearchEngineService(
        searchEngineClient.SearchEngineClient.createNull(new NullTypesenseClient([])),
        repos,
      )

      const collections = [{ id: '123456abc' } as entity.Collection, { id: '789012def' } as entity.Collection]

      expect.assertions(1)
      await seService.deleteCollections(collections)
      expect(true).toBeTruthy()
    })
  })
})
