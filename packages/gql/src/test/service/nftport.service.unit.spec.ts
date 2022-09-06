import { retrieveNFTDetailsNFTPort } from '@nftcom/gql/service/nftport.service'

jest.setTimeout(150000)

jest.mock('@nftcom/gql/service/cache.service', () => ({
  cache: {
    get: jest.fn(),
    set: jest.fn(),
  },
  createCacheConnection: jest.fn(),
}))

describe('nftport', () => {
  describe('retrieveNFTDetailsNFTPort', () => {
    it.only('it should retrieve undefined', async () => {
      const contract = '0xd98335861E2FAe4cF42bB3A2E7830740175e7c41'
      const tokenId = '0x00'
      const nftDetails = await retrieveNFTDetailsNFTPort(contract, tokenId, '1')
      expect(nftDetails).toBeDefined()
    })
  })
})
