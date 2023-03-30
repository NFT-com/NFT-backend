import { buildApprovalInsufficientMsg, buildApprovalNotFoundMsg } from './approval.error'

describe('approval error', () => {
  describe('buildApprovalNotFoundMsg', () => {
    it('gets a message', () => {
      const msg = buildApprovalNotFoundMsg()
      expect(msg).toBe('Approval not found')
    })
  })
  describe('buildApprovalInsufficientMsg', () => {
    it('gets a message', () => {
      const msg = buildApprovalInsufficientMsg()
      expect(msg).toBe('Approval too small')
    })
  })
})
