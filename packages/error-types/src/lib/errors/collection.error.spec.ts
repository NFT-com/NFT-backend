import { buildCollectionNotFoundMsg } from './collection.error'

describe('collection error', () => {
  describe('buildCollectionNotFoundMsg', () => {
    it('sets an id in the message', () => {
      const msg = buildCollectionNotFoundMsg('qfkneqwioeqw')
      expect(msg).toBe('Collection qfkneqwioeqw not found')
    })
  })
})
