import axios from 'axios'
import { DataSource } from 'typeorm'

import { getContractSalesStatistics, getNFTDetails } from '@nftcom/gql/resolver/contractData.resolver'
import { testMockWallet, testMockWatchlistUser } from '@nftcom/gql/test/util/constants'
import { clearDB } from '@nftcom/gql/test/util/helpers'
import { getTestApolloServer } from '@nftcom/gql/test/util/testApolloServer'
import { testDBConfig } from '@nftcom/misc'
import { db, defs } from '@nftcom/shared'

jest.setTimeout(300000)
jest.retryTimes(2)

jest.mock('axios')
const mockedAxios = axios as jest.Mocked<typeof axios>

jest.mock('@nftcom/nftport-client', () => {
  const original = jest.requireActual('@nftcom/nftport-client')

  return {
    ...original,
    getNFTPortInterceptor: (_baseURL: string) => {
      return mockedAxios
    },
  }
})

jest.mock('@nftcom/cache', () => ({
  redisConfig: {},
  cache: {
    get: jest.fn(),
    set: jest.fn(),
  },
  CacheKeys: {
    GET_TX_BY_CONTRACT: 'get_tx_by_contract',
    GET_TX_BY_NFT: 'get_tx_by_nft',
  },
}))

const repositories = db.newRepositories()
let connection: DataSource
let testServer

describe('contract data resolver', () => {
  beforeAll(async () => {
    connection = await db.connectTestDB(testDBConfig)
  })

  afterAll(async () => {
    if (!connection) return
    await connection.destroy()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('getNFTDetails', () => {
    it('should return nft details', async () => {
      const nftDetails = {
        response: 'OK',
        nft: {
          chain: 'ethereum',
          contract_address: '0x98ca78e89dd1abe48a53dee5799f24cc1a462f2d',
          token_id: '625',
          metadata_url: 'https://prod-api.nft.com/uri/pepe',
          metadata: {
            description: 'NFT.com profile for pepe',
            header: 'https://cdn.nft.com/profile-banner-default-logo-key.png',
            image: 'https://cdn.nft.com/profiles/1651637367539-pepe.svg',
            name: 'pepe',
          },
          file_information: null,
          file_url: 'https://cdn.nft.com/profiles/1651637367539-pepe.svg',
          animation_url: null,
          cached_file_url:
            'https://storage.googleapis.com/sentinel-nft/raw-assets/d8bfe199789cb0cf1739900f7d014e958c786d67ba4cc9ef581d44a481d6e465.svg+xml',
          cached_animation_url: null,
          mint_date: '2022-04-29T23:10:10',
          updated_date: '2022-05-11T16:30:21.412678',
        },
        owner: '0x17cabb6dc7de7e3e562b0993086915c2c0209860',
        contract: {
          name: 'NFT.com Profile',
          symbol: 'NFTPROFILE',
          type: 'ERC721',
          metadata: {
            description: 'NFT Profiles for NFT.com',
            thumbnail_url:
              'https://lh3.googleusercontent.com/U5pRG_3Sw8I9vbDHfGQyi5_6INrgxD2hsx3nbMnwr84n8BdzFGYNnZrmvYf9z773t8b8wqlpNAI-N7wTexc3uOiVAcj0_IsjcBCTdw=s120',
            cached_thumbnail_url:
              'https://storage.googleapis.com/sentinel-nft/raw-assets/68ebcd748427910eb0e23783a6deb15acb0ba60987cd94a7eef28b7aa72028fc.png',
            banner_url:
              'https://lh3.googleusercontent.com/OvplKu8P0_wcPSCMxio11LpK9uB5oodFOGsmPtF0ND2Tjj3-dfkVFKIIfM6hI3In7_zoE0cVBfcQmkK0FhnXEj-y5-zK8d8ZF9aKgw=s2500',
            cached_banner_url:
              'https://storage.googleapis.com/sentinel-nft/raw-assets/a704d6d173cee6719fd7987ab01b8f0c47910df2d1621c292df55cc927af98ce.png',
          },
        },
      }
      mockedAxios.get.mockResolvedValueOnce(Promise.resolve({ data: nftDetails }))

      const response = await getNFTDetails(
        undefined,
        { input: { contractAddress: '0x98ca78e89Dd1aBE48A53dEe5799F24cC1A462F2D', tokenId: '625' } },
        undefined,
      )

      expect(mockedAxios.get).toHaveBeenCalled()
      expect(response).toEqual(nftDetails)
    })
  })
  describe('getContractSalesStatistics', () => {
    it('should return contract sales stats', async () => {
      const salesStats = {
        response: 'OK',
        statistics: {
          one_day_volume: 0.055,
          one_day_change: 0,
          one_day_sales: 2,
          one_day_average_price: 0.0275,
          seven_day_volume: 0.375,
          seven_day_change: -0.8809927259294943,
          seven_day_sales: 4,
          seven_day_average_price: 0.09375,
          thirty_day_volume: 4.508866889999999,
          thirty_day_change: 0.34152939758821055,
          thirty_day_sales: 32,
          thirty_day_average_price: 0.1409020903125,
          total_volume: 144.9268831145444,
          total_sales: 573,
          total_supply: 9229,
          total_minted: 9229,
          num_owners: 2383,
          average_price: 0.25292606110740734,
          market_cap: 865.21875,
          floor_price: 0.02,
          floor_price_historic_one_day: 0.02,
          floor_price_historic_seven_day: 0.02,
          floor_price_historic_thirty_day: 0.02,
          updated_date: '2022-09-02T16:34:41.033786',
        },
      }
      mockedAxios.get.mockResolvedValueOnce(Promise.resolve({ data: salesStats }))

      const response = await getContractSalesStatistics(
        undefined,
        { input: { contractAddress: '0x98ca78e89Dd1aBE48A53dEe5799F24cC1A462F2D' } },
        undefined,
      )

      expect(mockedAxios.get).toHaveBeenCalled()
      expect(response).toEqual(salesStats)
    })
  })

  describe('getTxByContract', () => {
    beforeAll(async () => {
      testServer = getTestApolloServer(repositories, testMockWatchlistUser, testMockWallet)
      await repositories.nftPortTransaction.save({
        type: 'mint',
        ownerAddress: '0x4794c458651e2e764e2d88fa2c9d9fd0383ae558',
        contractAddress: '0x98ca78e89Dd1aBE48A53dEe5799F24cC1A462F2D',
        tokenId: '0x241c',
        quantity: 1,
        transactionHash: '0x762cd78a0cdc579e0870b6374ae822bc20f746994d58eb5945e907b4f928d87d',
        blockHash: '0x287aad8bc31bb89737f6a334154032ee4127e51448dd177e72d42f7009251799',
        blockNumber: '15460244',
        transactionDate: new Date('2022-09-02T16:36:59'),
        chainId: '1',
      })
      await repositories.nftPortTransaction.save({
        type: 'transfer',
        transferFrom: '0x661e73048ae97e51285cad5d6a6f502c3ace1b98',
        transferTo: '0xe70c5207f6389129ac44054e2403210e6377c778',
        contractAddress: '0x98ca78e89Dd1aBE48A53dEe5799F24cC1A462F2D',
        tokenId: '0x1218',
        quantity: 1,
        transactionHash: '0xbfc5b85394d0348c9456ad1c281ba6a8c9fb75ab90b6aab179d6b07d57402c77',
        blockHash: '0x7b7465cd17491ff3ce9119b219a282889d51b54e0693dc6e6226e5aac7a31082',
        blockNumber: '15455056',
        transactionDate: new Date('2022-09-01T20:51:48'),
        chainId: '1',
      })
      await repositories.nftPortTransaction.save({
        type: 'sale',
        buyerAddress: '0xe70c5207f6389129ac44054e2403210e6377c778',
        sellerAddress: '0x661e73048ae97e51285cad5d6a6f502c3ace1b98',
        nft: {
          contractType: 'ERC721',
          contractAddress: '0x98ca78e89Dd1aBE48A53dEe5799F24cC1A462F2D',
          tokenId: '0x1218',
        },
        quantity: 1,
        priceDetails: {
          assetType: 'ETH',
          price: '0.03',
          priceUSD: '47.33039780304282',
        },
        transactionHash: '0xbfc5b85394d0348c9456ad1c281ba6a8c9fb75ab90b6aab179d6b07d57402c77',
        blockHash: '0x7b7465cd17491ff3ce9119b219a282889d51b54e0693dc6e6226e5aac7a31082',
        blockNumber: '15455056',
        transactionDate: new Date('2022-09-01T20:51:48'),
        marketplace: defs.NFTPortMarketplace.OpenSea,
        chainId: '1',
      })

      await repositories.nftPortTransaction.save({
        type: 'list',
        listerAddress: '0xa89c94db9e4792ebef380b959f18a2e45814ca4a',
        nft: {
          contractType: 'ERC721',
          contractAddress: '0x98ca78e89Dd1aBE48A53dEe5799F24cC1A462F2D',
          tokenId: '0x0205',
        },
        quantity: 1,
        priceDetails: {
          assetType: 'ETH',
          price: '0.065',
        },
        transactionDate: new Date('2023-02-02T18:23:30.027'),
        marketplace: defs.NFTPortMarketplace.OpenSea,
        chainId: '1',
      })
    })
    afterAll(async () => {
      await clearDB(repositories)
      await testServer.stop()
    })

    it('should return transactions with specific types by contract', async () => {
      mockedAxios.post.mockResolvedValueOnce(Promise.resolve({ data: { message: 'Sync started.' } }))

      const result = await testServer.executeOperation({
        query: `query GetTxByContract($input: TransactionsByContractInput) {
                getTxByContract(input: $input) {
                  items {
                    index
                    type
                  }
                  totalItems
                }
              }`,
        variables: {
          input: {
            contractAddress: '0x98ca78e89dd1abe48a53dee5799f24cc1a462f2d',
            chain: 'ethereum',
            type: ['list'],
            pageInput: {
              first: 50,
            },
          },
        },
      })
      expect(result.data.getTxByContract.items.length).toEqual(1)

      expect(mockedAxios.post).toHaveBeenCalled()
    })
  })

  describe('getTxByNFT', () => {
    beforeAll(async () => {
      testServer = getTestApolloServer(repositories, testMockWatchlistUser, testMockWallet)
      await repositories.nftPortTransaction.save({
        type: 'mint',
        ownerAddress: '0x185d8Ca57797f5BCBac2DB01126403c26F504CA4',
        contractAddress: '0x98ca78e89Dd1aBE48A53dEe5799F24cC1A462F2D',
        tokenId: '0x0271',
        quantity: 1,
        transactionHash: '0x65c838c83d5e287d342445c85ccbb0347e53a1d4cb6ba2cc5956179777da4d9f',
        blockHash: '0xaedd36209614d291fe2892cd821c75baef4635bfc568f9830ae0d76aaecea229',
        blockNumber: '14682058',
        transactionDate: new Date('2022-04-29T23:10:10'),
        chainId: '1',
      })
      await repositories.nftPortTransaction.save({
        type: 'transfer',
        transferFrom: '0x185d8Ca57797f5BCBac2DB01126403c26F504CA4',
        transferTo: '0x17caBb6Dc7de7e3e562b0993086915C2c0209860',
        contractAddress: '0x98ca78e89Dd1aBE48A53dEe5799F24cC1A462F2D',
        tokenId: '0x0271',
        quantity: 1,
        transactionHash: '0x6288f7ca97136d2833165b2a552eb67e730afaca80464ab80104bfc1e79e207f',
        blockHash: '0x6fbdd30922014e55518caf336f8f06a255913db09b50f5623c660887288f958c',
        blockNumber: '14864290',
        transactionDate: new Date('2022-05-29T03:52:32'),
        chainId: '1',
      })
    })
    afterAll(async () => {
      await clearDB(repositories)
      await testServer.stop()
    })

    it('should return transactions by NFT', async () => {
      mockedAxios.post.mockResolvedValueOnce(Promise.resolve({ data: { message: 'Sync started.' } }))

      const result = await testServer.executeOperation({
        query: `query GetTxByNFT($input: TransactionsByNFTInput) {
                getTxByNFT(input: $input) {
                  items {
                    index
                    priceDetails {
                      price
                    }
                  }
                  totalItems
                }
              }`,
        variables: {
          input: {
            contractAddress: '0x98ca78e89dd1abe48a53dee5799f24cc1a462f2d',
            tokenId: '0x271',
            chain: 'ethereum',
            type: ['all'],
            pageInput: {
              first: 50,
            },
          },
        },
      })
      expect(result.data.getTxByNFT.items.length).toEqual(2)
      expect(mockedAxios.post).toHaveBeenCalled()
    })
  })
})
