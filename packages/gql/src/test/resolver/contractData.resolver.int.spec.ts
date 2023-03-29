import axios from 'axios'
import { parseISO } from 'date-fns'
import { utils } from 'ethers'

import { testDBConfig } from '@nftcom/gql/config'
import { db } from '@nftcom/shared'

import { getTestApolloServer } from '../util/testApolloServer'

let testServer, connection

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
    get: jest.fn().mockImplementation(key => {
      if (key === 'ERC20_SYMBOL_0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2') {
        return 'WETH'
      }
      return null
    }),
    set: jest.fn(),
    zscore: jest.fn().mockReturnValue(0),
    zadd: jest.fn(),
  },
}))

describe('contract data resolver', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('getSales', () => {
    beforeAll(async () => {
      connection = await db.connectTestDB(testDBConfig)
      testServer = getTestApolloServer({
        marketplaceSale: {
          saveMany: entities => Promise.resolve(entities),
          find: (_options: any) => Promise.resolve([]),
        },
      })
    })
    afterAll(async () => {
      await testServer.stop()
      if (!connection) return
      await connection.destroy()
    })
    it('should return sales by contract address', async () => {
      const transactions = [
        {
          response: 'OK',
          continuation: 'abcdefg1234567890',
          transactions: [
            {
              type: 'sale',
              buyer_address: '0xe70c5207f6389129ac44054e2403210e6377c778',
              seller_address: '0x661e73048ae97e51285cad5d6a6f502c3ace1b98',
              nft: {
                contract_type: 'ERC721',
                contract_address: '0x98ca78e89dd1abe48a53dee5799f24cc1a462f2d',
                token_id: '4632',
              },
              quantity: 1,
              price_details: {
                asset_type: 'ETH',
                price: 0.01,
                price_usd: 1.0,
              },
              transaction_hash: '0xbfc5b85394d0348c9456ad1c281ba6a8c9fb75ab90b6aab179d6b07d57402c77',
              block_hash: '0x7b7465cd17491ff3ce9119b219a282889d51b54e0693dc6e6226e5aac7a31082',
              block_number: 15455056,
              transaction_date: '2022-09-01T20:51:48',
              marketplace: 'opensea',
            },
          ],
        },
        {
          response: 'OK',
          transactions: [
            {
              type: 'sale',
              buyer_address: '0xe70c5207f6389129ac44054e2403210e6377c778',
              seller_address: '0x661e73048ae97e51285cad5d6a6f502c3ace1b98',
              nft: {
                contract_type: 'ERC721',
                contract_address: '0x98ca78e89dd1abe48a53dee5799f24cc1a462f2d',
                token_id: '4632',
              },
              quantity: 1,
              price_details: {
                asset_type: 'ERC20',
                contract_address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
                price: 0.02,
                price_usd: 2,
              },
              transaction_hash: '0xbfc5b85394d0348c9456ad1c281ba6a8c9fb75ab90b6aab179d6b07d57402c78',
              block_hash: '0x7b7465cd17491ff3ce9119b219a282889d51b54e0693dc6e6226e5aac7a31082',
              block_number: 15455056,
              transaction_date: '2022-09-01T20:51:48',
              marketplace: 'opensea',
            },
          ],
        },
      ]
      mockedAxios.get
        .mockResolvedValueOnce(Promise.resolve({ data: transactions[0] }))
        .mockResolvedValueOnce(Promise.resolve({ data: transactions[1] }))

      const response = await testServer.executeOperation({
        query: `query GetSales($input: TransactionSalesInput) {
          getSales(input: $input) {
            contractAddress
            tokenId
            priceUSD
            price
            symbol
            date
          }
        }`,
        variables: { input: { contractAddress: '0x60e4d786628fea6478f785a6d7e704777c86a7c6' } },
      })

      const tx1 = transactions[0].transactions[0]
      const tx2 = transactions[1].transactions[0]
      expect(response.data.getSales).toEqual([
        {
          priceUSD: tx1.price_details.price_usd,
          price: tx1.price_details.price,
          symbol: 'ETH',
          date: parseISO(tx1.transaction_date),
          contractAddress: utils.getAddress(tx1.nft.contract_address),
          tokenId: tx1.nft.token_id,
        },
        {
          priceUSD: tx2.price_details.price_usd,
          price: tx2.price_details.price,
          symbol: 'WETH',
          date: parseISO(tx2.transaction_date),
          contractAddress: utils.getAddress(tx2.nft.contract_address),
          tokenId: tx2.nft.token_id,
        },
      ])
    })
  })
})
