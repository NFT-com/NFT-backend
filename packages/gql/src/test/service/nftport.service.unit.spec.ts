import {
  retrieveContractNFTs,
  retrieveNFTDetailsNFTPort,
} from '@nftcom/gql/service/nftport.service'

jest.setTimeout(150000)

jest.mock('@nftcom/cache', () => ({
  redisConfig: {},
  cache: {
    get: jest.fn(),
    set: jest.fn(),
  },
  createCacheConnection: jest.fn(),
}))

const validateNFTsResponse = (res: any): void => {
  expect(res).toBeDefined()
  expect(res.nfts).toBeDefined()
  expect(res.nfts.length).toBeGreaterThan(0)
  expect(res.contract).toBeDefined()
  expect(res.contract.name).toBeDefined()
  expect(res.contract.symbol).toBeDefined()
  expect(res.contract.type).toBeDefined()
  expect(res.contract.metadata).toBeDefined()
  expect(res.contract.metadata.description).toBeDefined()
  expect(res.contract.metadata.thumbnail_url).toBeDefined()
  expect(res.contract.metadata.cached_thumbnail_url).toBeDefined()
  expect(res.contract.metadata.banner_url).toBeDefined()
  expect(res.contract.metadata.cached_banner_url).toBeDefined()
}

describe('nftport', () => {
  describe('retrieveNFTDetailsNFTPort', () => {
    it('it should retrieve undefined', async () => {
      const contract = '0xd98335861E2FAe4cF42bB3A2E7830740175e7c41'
      const tokenId = '0x00'
      const nftDetails = await retrieveNFTDetailsNFTPort(contract, tokenId, '1')
      expect(nftDetails).toBeDefined()
    })
  })

  describe('retrieveContractNFTs', () => {
    it('it should retrieve nfts of cryptokitty', async () => {
      const contract = '0x06012c8cf97BEaD5deAe237070F9587f8E7A266d'
      const res = await retrieveContractNFTs(contract,  '1')
      validateNFTsResponse(res)
    })

    it('it should retrieve nfts of cryptopunks', async () => {
      const contract = '0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB'
      const res = await retrieveContractNFTs(contract,  '1')
      validateNFTsResponse(res)
    })

    it('it should retrieve nfts of mooncat', async () => {
      const contract = '0xc3f733ca98E0daD0386979Eb96fb1722A1A05E69'
      const res = await retrieveContractNFTs(contract,  '1')
      validateNFTsResponse(res)
    })

    it('it should retrieve nfts of rare pepe', async () => {
      const contract = '0x937a2cd137FE77dB397c51975b0CaAaa29559CF7'
      const res = await retrieveContractNFTs(contract,  '1')
      validateNFTsResponse(res)
    })

    it('it should retrieve nfts of ether rock', async () => {
      const contract = '0xA3F5998047579334607c47a6a2889BF87A17Fc02'
      const res = await retrieveContractNFTs(contract,  '1')
      validateNFTsResponse(res)
    })
  })
})
