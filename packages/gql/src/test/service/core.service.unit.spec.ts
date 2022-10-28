import { BigNumber } from 'ethers'

import { testDBConfig } from '@nftcom/gql/config'
import { Context } from '@nftcom/gql/defs'
import { WalletInput } from '@nftcom/gql/defs/gql'
import { createProfileFromEvent, getWallet } from '@nftcom/gql/service/core.service'
import { clearDB } from '@nftcom/gql/test/util/helpers'
import { db, defs } from '@nftcom/shared'
import { User, Wallet } from '@nftcom/shared/db/entity'

import { testMockUser, testMockWallet } from '../util/constants'

jest.setTimeout(500000)

const repositories = db.newRepositories()

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

let connection

describe('core service', () => {
  beforeAll(async () => {
    connection = await db.connectTestDB(testDBConfig)
  })

  afterAll(async () => {
    if (!connection) return
    await connection.destroy()
  })

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

  describe('createProfileFromEvent', () => {
    afterAll(async () => {
      await clearDB(repositories)
    })

    it('should save incentive action', async () => {
      const profile = await createProfileFromEvent(
        '5',
        '0xC345420194D9Bac1a4b8f698507Fda9ecB2E3005',
        BigNumber.from('5'),
        repositories,
        'test-profile',
      )
      expect(profile).toBeDefined()
      expect(profile.ownerUserId).not.toBeNull()
      expect(profile.ownerWalletId).not.toBeNull()
      const incentiveAction = await repositories.incentiveAction.findOne({
        where: {
          userId: profile.ownerUserId,
          profileUrl: profile.url,
          task: defs.ProfileTask.CREATE_NFT_PROFILE,
        },
      })
      expect(incentiveAction).toBeDefined()
    })
  })
})
