import { BigNumber, ethers } from 'ethers'

import { testDBConfig } from '@nftcom/gql/config'
import { Context } from '@nftcom/gql/defs'
import { WalletInput } from '@nftcom/gql/defs/gql'
import { createLoaders } from '@nftcom/gql/server'
import { createProfileFromEvent, fetchDataUsingMulticall, getWallet } from '@nftcom/gql/service/core.service'
import { clearDB } from '@nftcom/gql/test/util/helpers'
import { contracts, db, defs } from '@nftcom/shared'
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
  loaders: createLoaders(),
  repositories: {
    wallet: {
      // mocks that mockWallet is in db, and other wallets return empty response
      findByNetworkChainAddress: (network, chainId, address) => {
        if (
          network === testMockWallet.network &&
          chainId === testMockWallet.chainId &&
          address === testMockWallet.address
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
    beforeAll(async () => {
      await repositories.user.save({
        email: testMockUser.email,
        username: 'test-user',
        referralId: 'userA-referralId',
        preferences: testMockUser.preferences,
      })
      const userB = await repositories.user.save({
        email: 'test@immutableholdings.com',
        username: 'ethereum-0xC345420194D9Bac1a4b8f698507Fda9ecB2E3005',
        referredBy: 'userA-referralId::test-profile-A',
        referralId: '',
        isEmailConfirmed: true,
      })
      await Promise.all([
        repositories.user.save({
          email: 'test2@immutableholdings.com',
          username: 'ethereum-0xC345420194D9Bac1a4b8f698507Fda9ecB2E3009',
          referredBy: 'userA-referralId::test-profile-A',
          referralId: '',
          isEmailConfirmed: true,
        }),
        repositories.user.save({
          email: 'test3@immutableholdings.com',
          username: 'ethereum-0xC345420194D9Bac1a4b8f698507Fda9ecB2E3008',
          referredBy: 'userA-referralId::test-profile-A',
          referralId: '',
          isEmailConfirmed: true,
        }),
        repositories.user.save({
          email: 'test4@immutableholdings.com',
          username: 'ethereum-0xC345420194D9Bac1a4b8f698507Fda9ecB2E3007',
          referredBy: 'userA-referralId::test-profile-A',
          referralId: '',
          isEmailConfirmed: true,
        }),
        repositories.user.save({
          email: 'test5@immutableholdings.com',
          username: 'ethereum-0xC345420194D9Bac1a4b8f698507Fda9ecB2E3006',
          referredBy: 'userA-referralId::test-profile-A',
          referralId: '',
          isEmailConfirmed: true,
        }),
      ]).then(async users => {
        await Promise.all(
          users.map(user => {
            repositories.profile.save({
              url: `testprofile-${user.id}`,
              ownerUserId: user.id,
            })
          }),
        )
      })
      await repositories.wallet.save({
        address: ethers.utils.getAddress('0xC345420194D9Bac1a4b8f698507Fda9ecB2E3005'),
        network: 'ethereum',
        chainId: '5',
        chainName: 'goerli',
        userId: userB.id,
      })
    })
    afterAll(async () => {
      await clearDB(repositories)
    })

    it('should save incentive action for create NFT profile and refer network', async () => {
      const profile = await createProfileFromEvent(
        '5',
        '0xC345420194D9Bac1a4b8f698507Fda9ecB2E3005',
        BigNumber.from('5'),
        repositories,
        'test-profile-B',
      )
      expect(profile).toBeDefined()
      expect(profile.ownerUserId).not.toBeNull()
      expect(profile.ownerWalletId).not.toBeNull()
      const createProfileAction = await repositories.incentiveAction.findOne({
        where: {
          userId: profile.ownerUserId,
          profileUrl: profile.url,
          task: defs.ProfileTask.CREATE_NFT_PROFILE,
        },
      })
      expect(createProfileAction).toBeDefined()
      const referNetworkAction = await repositories.incentiveAction.findOne({
        where: {
          profileUrl: 'test-profile-A',
          task: defs.ProfileTask.REFER_NETWORK,
        },
      })
      expect(referNetworkAction).toBeDefined()
      expect(referNetworkAction.userId).toBeDefined()
    })
  })

  describe('fetchDataUsingMulticall', () => {
    it('should return expire date of profile', async () => {
      const abi = contracts.NftProfileABI()
      const calls = [
        {
          contract: contracts.nftProfileAddress('5'),
          name: 'getExpiryTimeline',
          params: [['lucas', 'gk']],
        },
        {
          contract: contracts.nftProfileAddress('5'),
          name: 'getExpiryTimeline',
          params: [['lucasgoerli', 'joey', 'donald']],
        },
      ]
      const res = await fetchDataUsingMulticall(calls, abi, '5')
      expect(res.length).toEqual(2)
      expect(res[0][0].length).toEqual(2)
      expect(res[1][0].length).toEqual(3)
    })
  })
})
