import { fetchData,getSalesData } from './contract-data'

describe('contractData', () => {
  describe('getSalesData', () => {
    it('should exist', () => {
      expect(typeof getSalesData).toBe('function')
    })
  })

  describe('fetchData', () => {
    it('should exist', () => {
      expect(typeof fetchData).toBe('function')
    })
  })
})
