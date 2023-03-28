import {
  buildCollectionNotFoundMsg,
  buildOfficialCollectionNotFoundMsg,
} from './collection.error'

describe('collection error', () => {
  describe('buildCollectionNotFoundMsg', () => {
    it('sets an id in the message', () => {
      const msg = buildCollectionNotFoundMsg('qfkneqwioeqw')
      expect(msg).toBe('Collection qfkneqwioeqw not found')
    })
  })

  describe('buildOfficialCollectionNotFoundMsg', () => {
    it('sets an id in the message', () => {
      const msg = buildOfficialCollectionNotFoundMsg('qfkneqwioeqw')
      expect(msg).toBe('Official collection qfkneqwioeqw not found')
    })
  })
})
