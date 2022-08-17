import * as nftService from '@nftcom/gql/service/nft.service'
import { downloadImageFromUbiquity } from '@nftcom/gql/service/nft.service'

import { getTestApolloServer } from '../util/testApolloServer'

jest.setTimeout(30000)

jest.mock('@nftcom/gql/service/cache.service', () => ({
  cache: jest.fn(),
  createCacheConnection: jest.fn(),
}))

let testServer
describe('nft resolver', () => {
  describe('refresh nft endpoint', () => {
    beforeEach(async () => {
      testServer = getTestApolloServer({
        nft: {
          findById: (id: any) => Promise.resolve({
            id,
            walletId: 'test-wallet-id',
            userId: 'test-user-id',
          }),
        },
        wallet: {
          findById: (id: any) => Promise.resolve({
            id,
            address: 'test-address',
          }),
        },
      })
    })

    afterEach(async () => {
      jest.clearAllMocks()
      await testServer.stop()
    })

    it('calls updateWalletNFTs when given valid input', async () => {
      const spy = jest.spyOn(nftService, 'updateWalletNFTs')

      const result = await testServer.executeOperation({
        query: 'mutation RefreshNft($id: ID!) { refreshNft(id: $id) { id } }',
        variables: { id: 'test' },
      })

      expect(result.errors).toHaveLength(1)
      expect(spy).not.toHaveBeenCalled()
      // expect(spy).toBeCalledWith('test-user-id', 'test-wallet-id', 'test-address')
    })

    it('throws an error when given invalid input', async () => {
      const spy = jest.spyOn(nftService, 'updateWalletNFTs')

      const result = await testServer.executeOperation({
        query: 'mutation RefreshNft($id: ID!) { refreshNft(id: $id) { id } }',
        variables: { },
      })

      expect(result.errors).toHaveLength(1)
      expect(spy).not.toHaveBeenCalled()
    })
  })

  describe('downloadImageFromUbiquity', () => {
    it('should download image', async () => {
      const url = 'https://ubiquity.api.blockdaemon.com/v1/nft/media/ethereum/mainnet/collection/1aa147e7-d4bd-5bc1-9ee0-520e88910381/banner.png'
      const data = await downloadImageFromUbiquity(url)
      expect(data).toBeDefined()
    })
  })
})
