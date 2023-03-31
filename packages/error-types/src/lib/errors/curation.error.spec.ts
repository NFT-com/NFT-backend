import { buildCurationNotFoundMsg, buildCurationNotOwnedMsg } from './curation.error'

describe('curation error', () => {
  describe('buildCurationNotFoundMsg', () => {
    it('sets an id in the message', () => {
      const msg = buildCurationNotFoundMsg('qfkneqwioeqw')
      expect(msg).toBe('Curation qfkneqwioeqw not found')
    })
  })
  describe('buildCurationNotOwnedMsg', () => {
    it('gets a message', () => {
      const msg = buildCurationNotOwnedMsg()
      expect(msg).toBe('Curation not owned by user')
    })
  })
})
