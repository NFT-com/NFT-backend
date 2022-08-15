import { SearchEngineClient } from '@nftcom/gql/adapter/searchEngineClient'
import { SearchEngineService } from '@nftcom/gql/service/searchEngine.service'
import { Collection, NFT, Wallet } from '@nftcom/shared/db/entity'

import { NullTypesenseClient } from '../__nulls__/NullTypesenseClient'

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
      } as NFT

      repos = {
        nft: {
          findById: (_: string) => {
            return Promise.resolve(nft)
          },
        },
        collection: {
          findById: (_: string) => {
            return Promise.resolve(new Collection())
          },
        },
        wallet: {
          findById: (_: string) => {
            return Promise.resolve(new Wallet())
          },
        },
      }
    })

    afterEach(() => {
      jest.clearAllMocks()
    })

    it('sends an NFT to the search engine', async () => {
      const seService = new SearchEngineService(
        SearchEngineClient.createNull(new NullTypesenseClient([{ success: true }])), repos)

      const result = await seService.indexNFT(nft)

      expect(result).toBe(true)
    })

    it('notifies of an unsuccessful import', async () => {
      const seService = new SearchEngineService(
        SearchEngineClient.createNull(new NullTypesenseClient([{ success: false }])), repos)

      const result = await seService.indexNFT(nft)

      expect(result).toBe(false)
    })
  })

  describe('indexCollections', () => {
    let repos
    beforeAll(() => {
      repos = {
        nft: {
          findOne: (_: any) => {
            return Promise.resolve({ type: 'ERC721' } as NFT)
          },
        },
      }
    })

    afterEach(() => {
      jest.clearAllMocks()
    })

    it('sends collections to the search engine', async () => {
      const seService = new SearchEngineService(
        SearchEngineClient.createNull(new NullTypesenseClient(
          [{ success: true }, { success: true }])), repos)

      const collections = [
        { contract: '0xe0060010c2c81A817f4c52A9263d4Ce5c5B66D55' } as Collection,
        { contract: '0x9Ef7A34dcCc32065802B1358129a226B228daB4E' } as Collection,
      ]
      const result = await seService.indexCollections(collections)

      expect(result).toBe(true)
    })

    it('notifies of failed import', async () => {
      const seService = new SearchEngineService(
        SearchEngineClient.createNull(new NullTypesenseClient(
          [{ success: false }, { success: true }])), repos)

      const collections = [
        { contract: '0xe0060010c2c81A817f4c52A9263d4Ce5c5B66D55' } as Collection,
        { contract: '0x9Ef7A34dcCc32065802B1358129a226B228daB4E' } as Collection,
      ]
      const result = await seService.indexCollections(collections)

      expect(result).toBe(false)
    })
  })
})