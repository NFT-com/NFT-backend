import { parseISO } from 'date-fns'
import { utils } from 'ethers'
import Sinon from 'sinon'

import { fetchData } from '@nftcom/nftport-client'
import { db, provider } from '@nftcom/shared'

import { getContractSales } from './contract-sales'
jest.mock('@nftcom/nftport-client', () => ({
  fetchData: jest.fn(),
}))
const mockFetchData = fetchData as jest.Mock

jest.setTimeout(20000)

jest.mock('@nftcom/cache', () => ({
  redisConfig: {},
  cache: {
    get: (key: string) => {
      if (key.startsWith('ERC20_SYMBOL_')) {
        return Promise.resolve('WETH')
      }
      return Promise.resolve(undefined)
    },
    set: jest.fn(),
  },
}))

describe('contractSales', () => {
  describe('getContractSales', () => {
    const sandbox = Sinon.createSandbox()

    beforeEach(() => {
      sandbox.stub(db, 'getDataSource').returns({
        getRepository: () => {
          return {
            find: () => Promise.resolve([]),
            create: jest.fn(),
            save: jest.fn(),
          }
        },
      } as any)
      sandbox.stub(provider, 'provider').returns(jest.fn() as any)
    })

    afterEach(() => {
      sandbox.restore()
    })

    it('should exist', () => {
      expect(typeof getContractSales).toBe('function')
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
      mockFetchData.mockResolvedValueOnce(transactions[0]).mockResolvedValueOnce(transactions[1])

      const salesData = await getContractSales('0x60e4d786628fea6478f785a6d7e704777c86a7c6')

      const tx1 = transactions[0].transactions[0]
      const tx2 = transactions[1].transactions[0]
      expect(salesData).toEqual([
        {
          id: '8311e88e64099512d9db063159c23abac8e04f773eb9daca0a46b0f0294c6ef0',
          priceUSD: tx1.price_details.price_usd,
          price: tx1.price_details.price,
          symbol: 'ETH',
          date: parseISO(tx1.transaction_date),
          contractAddress: utils.getAddress(tx1.nft.contract_address),
          tokenId: tx1.nft.token_id,
          transaction: tx1,
        },
        {
          id: 'eabd52a6657171b4349ab09ceba69c9dc5240d12edb90e9ff2815bfd1dd65bce',
          priceUSD: tx2.price_details.price_usd,
          price: tx2.price_details.price,
          symbol: 'WETH',
          date: parseISO(tx2.transaction_date),
          contractAddress: utils.getAddress(tx2.nft.contract_address),
          tokenId: tx2.nft.token_id,
          transaction: tx2,
        },
      ])
    })
  })
})
