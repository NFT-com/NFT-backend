import { Context } from '@nftcom/gql/defs'
import { WalletInput } from '@nftcom/gql/defs/gql'
import { getWallet } from '@nftcom/gql/service/core.service'
import { User, Wallet } from '@nftcom/shared/db/entity'

import { testMockUser, testMockWallet } from '../util/constants'

const context: Context = {
  chain: {
    id: testMockWallet.chainId,
    name: testMockWallet.chainName,
  },
  network: 'ethereum',
  user: testMockUser as User,
  wallet: testMockWallet as Wallet,
  repositories: {
    wallet :{
      // mocks that mockWallet is in db, and other wallets return empty response
      findByNetworkChainAddress: (network, chainId, address) => {
        if (network === testMockWallet.network
                        && chainId === testMockWallet.chainId
                        && address === testMockWallet.address
        ) {
          return Promise.resolve({
            network,
            chainId,
            address,
          })
        }
        return Promise.resolve(null)
      },
    },
  } as any,
}

const walletInputSuccess: WalletInput = {
  address: testMockWallet.address,
  network: testMockWallet.network,
  chainId: testMockWallet.chainId,
}

const walletInputFailure: WalletInput = {
  address: 'test-address-failure',
  network: 'ethereum',
  chainId: '5',
}

const walletFailureResponse = 'Please signup or add this address before using'

describe('core service', () => {
  describe('get Wallet', () => {
    it('gets wallet', async () => {
      const wallet = await getWallet(context, walletInputSuccess)
      expect(wallet).toMatchObject(walletInputSuccess)
    })

    // confirm the flow
    it('throws an error', async () => {
      await expect(getWallet(context, walletInputFailure)).rejects.toThrow(walletFailureResponse)
    })
  })
})