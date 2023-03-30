import { fetchData } from '@nftcom/nftport-client'

import { updateContractStats } from './contract-stats'
jest.mock('@nftcom/nftport-client', () => ({
  fetchData: jest.fn(),
}))
const mockFetchData = fetchData as jest.Mock

import { entity } from '@nftcom/shared'
jest.mock('@nftcom/shared', () => {
  const original = jest.requireActual('@nftcom/shared')

  return {
    ...original,
    db: {
      getDataSource: jest.fn().mockReturnValue({
        getRepository: jest.fn().mockReturnValue({
          save: jest.fn().mockImplementation(args => {
            return args
          }),
        }),
      }),
    },
  }
})

describe('contract-stats', () => {
  describe('updateContractStats', () => {
    it('should save required stats', async () => {
      expect(typeof updateContractStats).toBe('function')
      mockFetchData.mockResolvedValue({
        statistics: {
          floor_price: 2.4,
          total_volume: 27370.823769036146,
          average_price: 1.956736042967983,
        },
      })

      const result = await updateContractStats([{ contract: '0x000' }] as entity.Collection[])
      expect(result).toEqual([
        {
          contract: '0x000',
          floorPrice: 2.4,
          totalVolume: 27370.823769036146,
          averagePrice: 1.956736042967983,
        },
      ])
    })

    it('should handle errors by not updating stats', async () => {
      expect(typeof updateContractStats).toBe('function')
      mockFetchData.mockImplementation(() => {
        throw new Error('error')
      })

      const result = await updateContractStats([{ contract: '0x000' }] as entity.Collection[])
      expect(result).toEqual([{ contract: '0x000' }])
    })
  })
})
