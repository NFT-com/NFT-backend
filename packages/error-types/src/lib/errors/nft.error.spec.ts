import {
  buildMemoTooLong,
  buildNFTNotFoundMsg,
  buildNFTNotOwnedMsg,
  buildNFTNotValid,
  buildProfileNotOwnedMsg,
} from './nft.error'

describe('nft error', () => {
  describe('buildNFTNotFoundMsg', () => {
    it('sets an id in the message', () => {
      const msg = buildNFTNotFoundMsg('qfkneqwioeqw')
      expect(msg).toBe('NFT qfkneqwioeqw not found')
    })
  })
  describe('buildNFTNotOwnedMsg', () => {
    it('gets a message', () => {
      const msg = buildNFTNotOwnedMsg()
      expect(msg).toBe('NFT not owned by user')
    })
  })
  describe('buildProfileNotOwnedMsg', () => {
    it('sets an id in the message', () => {
      const msg = buildProfileNotOwnedMsg('qfkneqwioeqw', '12345')
      expect(msg).toBe('NFT.com profile qfkneqwioeqw not owned by user 12345')
    })
  })
  describe('buildMemoTooLong', () => {
    it('gets a message', () => {
      const msg = buildMemoTooLong()
      expect(msg).toBe('Length of memo can not exceed 2000')
    })
  })
  describe('buildNFTNotOwbuildNFTNotValidnedMsg', () => {
    it('gets a message', () => {
      const msg = buildNFTNotValid()
      expect(msg).toBe('This NFT is not valid')
    })
  })
})
