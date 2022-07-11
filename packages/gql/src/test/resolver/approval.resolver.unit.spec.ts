import { ApprovalInput } from '@nftcom/gql/defs/gql'

import { testMockUser, testMockWallet } from '../util/constants'

const { core } = jest.requireActual('@nftcom/gql/service')

import { getTestApolloServer } from '../util/testApolloServer'

const approvalInput: ApprovalInput = {
  amount: 1,
  currency: '0x6dc0c0be4c8b2dfe750156dc7d59faabfb5b923d',
  deadline: 'test-deadline',
  nonce: 0,
  signature: {
    v: 0,
    r: '0x',
    s: '0x',
  },
  spender: 'test-spender',
  txHash: 'test-tx-hash',
  wallet: {
    address: testMockWallet.address,
    chainId: testMockWallet.chainId,
    network: testMockWallet.network,
  },
}

const entitySavedId = 'test-entity-id'

let entityCreatedAt

let testServer

jest.mock('@nftcom/gql/service', () => {
  return {
    core: {
      ...core,
      getWallet: () => Promise.resolve(approvalInput.wallet),
    },
  }
})

describe('approval resolver', () => {
  describe('approve amount', () => {
    beforeAll(async () => {
      entityCreatedAt = new Date()
      testServer = getTestApolloServer({
        approval: {
          save: (entityToBeSaved) => Promise.resolve({
            id: entitySavedId,
            createdAt: entityCreatedAt,
            ...entityToBeSaved,
          }),
        },
      },
      testMockUser,
      testMockWallet,
      )
    })
      
    afterAll(async () => {
      jest.clearAllMocks()
      await testServer.stop()
    })

    // Since WHITELIST is being fetched from ABI JSON, we could directly call the function and not mock
    it('should approve', async () => {
      const approvalResponse = await testServer.executeOperation({
        query: `mutation Mutation($input: ApprovalInput!) {
                approveAmount(input: $input) {
                  id
                  amount
                  currency
                  deadline
                  nonce
                  signature {
                    v
                    r
                    s
                  }
                  txHash
                  spender
                  createdAt
                }
              }`,
        variables: { input: approvalInput },
      })

      expect(approvalResponse?.data?.approveAmount).not.toBeNull()
      expect(approvalResponse?.data?.approveAmount?.id).not.toBeNull()
      expect(approvalResponse?.data?.approveAmount?.id).toBe(entitySavedId)
    })

    it('should fail to approve', async () => {
      const approvalResponse = await testServer.executeOperation({
        query: `mutation Mutation($input: ApprovalInput!) {
                approveAmount(input: $input) {
                  id
                  amount
                  currency
                  deadline
                  nonce
                  signature {
                    v
                    r
                    s
                  }
                  txHash
                  spender
                  createdAt
                }
              }`,
        variables: { input: {
          ...approvalInput,
          amount: -1,
        } },
      })

      expect(approvalResponse?.errors).toHaveLength(1)
    })
  })
})
  