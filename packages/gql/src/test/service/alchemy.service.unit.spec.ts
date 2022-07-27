import {
  getLatestBlockNumber,
} from '@nftcom/gql/service/alchemy.service'

jest.setTimeout(30000)

jest.mock('@nftcom/gql/service/cache.service', () => ({
  cache: jest.fn(),
  createCacheConnection: jest.fn(),
}))

const REQUEST_URL = process.env.ALCHEMY_API_URL

describe('alchemy service functions', () => {
  it('should get the latest block', async () => {
    const block = await getLatestBlockNumber(REQUEST_URL)
    expect(block).not.toBeNull()
    expect(parseInt(block, 16)).toBeGreaterThan(0)
  })
})