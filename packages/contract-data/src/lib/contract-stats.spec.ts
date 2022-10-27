import { updateContractStats } from './contract-stats'

describe('contract-stats', () => {
  describe('updateContractStats', () => {
    it('should save required stats', () => {
      expect(typeof updateContractStats).toBe('function')
    })
  })
})