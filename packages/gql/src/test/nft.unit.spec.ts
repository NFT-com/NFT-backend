
import * as nftService from '@nftcom/gql/service/nft.service'

import { getTestApolloServer } from './util/testApolloServer'

jest.setTimeout(20000)

describe('nft resolver', () => {
  describe('refresh nft endpoint', () => {
    let testServer
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

    afterEach(() => {
      jest.clearAllMocks()
    })

    it('calles updateWalletNFTs when given valid input', async () => {
      const spy = jest.spyOn(nftService, 'updateWalletNFTs')
        
      const result = await testServer.executeOperation({
        query: 'mutation RefreshNft($id: ID!) { refreshNft(id: $id) { id } }',
        variables: { id: 'test' },
      })
        
      expect(result.errors).toBeUndefined()
      expect(spy).toBeCalledWith('test-user-id', 'test-wallet-id', 'test-address')
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
})
