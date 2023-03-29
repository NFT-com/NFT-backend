import { DataSource } from 'typeorm'

import { testDBConfig } from '@nftcom/gql/config'
import { db } from '@nftcom/shared'
import { TxActivity, TxOrder, TxTransaction } from '@nftcom/shared/db/entity'
import { ActivityStatus, ActivityType, ExchangeType, ProtocolType } from '@nftcom/shared/defs'

import { testMockUser, testMockWallet } from '../util/constants'
import { getTestApolloServer } from '../util/testApolloServer'

jest.setTimeout(300000)
jest.retryTimes(2)

jest.mock('@nftcom/cache', () => ({
  redisConfig: {},
  cache: {
    get: jest.fn(),
    set: jest.fn(),
  },
  CacheKeys: {
    GET_ACTIVITIES: 'get_activities',
  },
  createCacheConnection: jest.fn(),
}))

const repositories = db.newRepositories()
const realOrderHash = '0x5e963bf7209f7e4967a04169153919b7ede26bfcf1a66252e731eb6610f623f9'

let testServer
let testData
let connection: DataSource

describe('transaction activity resolver', () => {
  beforeAll(async () => {
    connection = await db.connectTestDB(testDBConfig)
    testServer = getTestApolloServer(repositories, testMockUser, testMockWallet)
    const timestamp = new Date().getTime()
    testData = await Promise.all(['txOrder', 'txTransaction', 'txCancel'].map(async (table, i) => {
      const orderHash = `${table}-hash`
      let activity = new TxActivity()
      activity.activityType = ActivityType.Listing
      activity.activityTypeId = orderHash
      activity.status = ActivityStatus.Valid
      activity.timestamp = new Date(timestamp + (10000 * i))
      let currentDate: Date = new Date()
      currentDate.setDate(currentDate.getDate() - 1)
      activity.expiration = currentDate
      activity.walletAddress = testMockWallet.address
      activity.nftContract ='0x47D3ceD01EF669eF085e041f94820EbE368bF27e'
      activity.nftId = ['ethereum/test-nft-contract/test-token-id']
      activity.chainId = '5'

      // only valid for 180 days
      const activitySeaport = new TxActivity()
      activitySeaport.activityType = ActivityType.Listing
      activitySeaport.activityTypeId = realOrderHash
      activitySeaport.status = ActivityStatus.Valid
      activitySeaport.timestamp = new Date(timestamp + (10000 * i))
      currentDate.setDate(currentDate.getDate() - 1)
      activitySeaport.expiration = currentDate
      activitySeaport.walletAddress = '0x893f5090014182A731800fd9Eab839386E25cAb8'
      activitySeaport.nftContract ='0x5c3B3D1Eb43E0FbbD53c8CF8f589Cd77D42FEC36'
      activitySeaport.nftId = ['ethereum/0x5c3B3D1Eb43E0FbbD53c8CF8f589Cd77D42FEC36/1594']
      activitySeaport.chainId = '1'

      let activityA = new TxActivity()
      activityA.activityType = ActivityType.Sale
      activityA.activityTypeId = '0x2bde65660d85e566a975ae592961aad79ffb13ccd7fcff17a9c16264ff309185:orderHash'
      activityA.status = ActivityStatus.Valid
      activityA.timestamp = new Date(timestamp + (10000 * i))
      currentDate = new Date()
      currentDate.setDate(currentDate.getDate() - 1)
      activityA.expiration = currentDate
      activityA.walletAddress = '0x487F09bD7554e66f131e24edC1EfEe0e0Dfa7fD1'
      activityA.nftContract ='0x47D3ceD01EF669eF085e041f94820EbE368bF27e'
      activityA.nftId = ['ethereum/test-nft-contract/test-token-id']
      activityA.chainId = '5'

      let activityType
      switch (table) {
      case 'txOrder':
        // listing
        activityType = new TxOrder()
        activityType.id = orderHash
        activityType.activity = activity
        activityType.exchange = ExchangeType.OpenSea
        activityType.orderHash = orderHash
        activityType.orderType = ActivityType.Listing
        activityType.makerAddress = ''
        activityType.protocol = ProtocolType.Seaport
        activityType.protocolData = {}
        activityType.chainId = '5'

        activity = await repositories.txActivity.save(activity)
        activityType.activity = activity
        activityType = await repositories.txOrder.save(activityType)

        // insert real orderHash listing for opensea seaport 1.4
        activityType = new TxOrder()
        activityType.id = realOrderHash
        activityType.activity = activitySeaport
        activityType.exchange = ExchangeType.OpenSea
        activityType.orderHash = realOrderHash
        activityType.orderType = ActivityType.Listing
        activityType.makerAddress = '0x893f5090014182A731800fd9Eab839386E25cAb8'
        activityType.protocol = ProtocolType.Seaport
        activityType.protocolData = {
          'parameters': {
            'offerer': '0x893f5090014182a731800fd9eab839386e25cab8',
            'offer': [
              {
                'itemType': 2,
                'token': '0x5c3B3D1Eb43E0FbbD53c8CF8f589Cd77D42FEC36',
                'identifierOrCriteria': '1594',
                'startAmount': '1',
                'endAmount': '1',
              },
            ],
            'consideration': [
              {
                'itemType': 0,
                'token': '0x0000000000000000000000000000000000000000',
                'identifierOrCriteria': '0',
                'startAmount': '97500000000000000000',
                'endAmount': '97500000000000000000',
                'recipient': '0x893f5090014182A731800fd9Eab839386E25cAb8',
              },
              {
                'itemType': 0,
                'token': '0x0000000000000000000000000000000000000000',
                'identifierOrCriteria': '0',
                'startAmount': '2500000000000000000',
                'endAmount': '2500000000000000000',
                'recipient': '0x0000a26b00c1F0DF003000390027140000fAa719',
              },
            ],
            'startTime': '1680115202',
            'endTime': '1695667202',
            'orderType': 0,
            'zone': '0x0000000000000000000000000000000000000000',
            'zoneHash': '0x3000000000000000000000000000000000000000000000000000000000000000',
            'salt': '0xd983cc4ff74a417804fb9d2e792c7f2',
            'conduitKey': '0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000',
            'totalOriginalConsiderationItems': 2,
            'counter': 0,
          },
          'signature': null,
        }
        activityType.chainId = '1'

        activity = await repositories.txActivity.save(activity)
        activityType.activity = activity
        activityType = await repositories.txOrder.save(activityType)

        break
      case 'txTransaction':
        // purchase
        activityType = new TxTransaction()
        activityType.id = orderHash
        activityType.activity = activityA
        activityType.exchange = ExchangeType.NFTCOM
        activityType.transactionType = ActivityType.Sale
        activityType.protocol = ProtocolType.NFTCOM
        activityType.protocolData = []
        activityType.transactionHash = '0x2bde65660d85e566a975ae592961aad79ffb13ccd7fcff17a9c16264ff309185:orderHash'
        activityType.blockNumber = 16594516
        activityType.maker = '0x487F09bD7554e66f131e24edC1EfEe0e0Dfa7fD1'
        activityType.taker = '0xf5de760f2e916647fd766B4AD9E85ff943cE3A2b'
        activityType.chainId = '5'

        activityA = await repositories.txActivity.save(activityA)
        activityType.activity = activityA
        activityType = await repositories.txTransaction.save(activityType)
        break
      default:
        return
      }
      return Promise.resolve({ table, activity, activityType })
    }))
  })

  afterAll(async () => {
    for (const item of testData) {
      if (item) {
        await repositories[item.table].hardDeleteByIds([item.activityType.id])
        await repositories.txActivity.hardDeleteByIds([item.activity.id])
      }
    }
    await testServer.stop()
    if (!connection) return
    await connection.destroy()
  })

  describe('transaction activity byType, byWalletAddress, and byWalletAddressAndType', () => {
    it('should query activity by type', async () => {
      const result = await testServer.executeOperation({
        query: `query Query($activityType: String, $chainId: String) { 
          getActivitiesByType(activityType: $activityType, chainId: $chainId) {
           order {
             id
             exchange
           }
            id
            activityType
            chainId
          }
        }`,
        variables: { activityType: 'Listing', chainId: '5' },
      })

      const orderData = testData.filter(data => data?.table === 'txOrder')
      const orderIds = orderData.map(order => order.activityType.id)
      const activities = result.data?.getActivitiesByType.filter(
        activity => activity.order && orderIds.includes(activity.order.id))

      for (const activity of activities) {
        expect(activity.activityType).toBe(ActivityType.Listing)
        expect(activity.order.exchange).toBe(ExchangeType.OpenSea)
      }
      expect(activities.length).toBe(orderData.length)
    })

    it('should be able to getSeaportSignatures', async () => {
      const orderHashes = [realOrderHash]
      const result = await testServer.executeOperation({
        query: `query Query($orderHashes: [String!]) {
          getSeaportSignatures(orderHashes: $orderHashes) {
            orderHash
            protocol
            protocolData
          }
        }`,
        variables: { orderHashes: orderHashes },
      })

      const signatures = result.data?.getSeaportSignatures
      expect(signatures.length).toBe(1)
      expect(signatures[0].orderHash).toBe(realOrderHash)
      expect(signatures[0].protocol).toBe(ProtocolType.Seaport)
      
      // expect signature of protocolData not be null
      expect(signatures[0].protocolData.signature).not.toBeNull()
      expect(signatures[0].protocolData.signature).toBe('0x92958f518befa425c708664b03e102806ec33914434fac277427ecc767a985650c02432238220a4e8b1fee77f16bddce5fb8ae899d35ef4d296aca215e53195a')
    })

    it('should query activity by wallet address', async () => {
      const result = await testServer.executeOperation({
        query: `query Query($walletAddress: String, $chainId: String) { 
          getActivitiesByWalletAddress(walletAddress: $walletAddress, chainId: $chainId) { 
            id 
            activityType
            read
            timestamp
            order {
              id,
              exchange
            }
          } 
        }`,
        variables: { walletAddress: testData[0].activity.walletAddress, chainId: '5' },
      })

      const testDataIds = testData.map(td => td && td.activity.id)
      const activities = result.data?.getActivitiesByWalletAddress.filter(
        activity => testDataIds.includes(activity.id))
      for (const activity of activities) {
        if (activity.activityType === ActivityType.Listing) {
          expect(activity.order.exchange).toBe(ExchangeType.OpenSea)
        } else if (activity.activityType === ActivityType.Bid) {
          expect(activity.order.exchange).toBe(ExchangeType.LooksRare)
        } else {
          fail(`Invalid activity type for test: ${activity.activityType}`)
        }
      }
      expect(activities.length).toBe(1)
    })

    it('should query activity by wallet address and type', async () => {
      const result = await testServer.executeOperation({
        query: `query Query($input: TxWalletAddressAndTypeInput) { 
          getActivitiesByWalletAddressAndType(input: $input) { 
            id 
            activityType
            read
            timestamp
            order {
              id
              exchange
            }
          } 
        }`,
        variables: { input: { walletAddress: testData[0].activity.walletAddress, activityType: 'Listing', chainId: '5' } },
      })
      const listData = testData.filter(data => data?.table === 'txOrder')
      const listIds = listData.map(ld => ld.activityType.id)
      const activities = result.data?.getActivitiesByWalletAddressAndType.filter(
        activity => activity.order && listIds.includes(activity.order.id))
      for (const activity of activities) {
        expect(activity.activityType).toBe(ActivityType.Listing)
        expect(activity.order.exchange).toBe(ExchangeType.OpenSea)
      }
      expect(activities.length).toBe(listData.length)
    })
  })

  describe('transaction activity with filters', () => {
    it('should query activities with filters', async () => {
      const result = await testServer.executeOperation({
        query: `query GetActivities($input: TxActivitiesInput) {
          getActivities(input: $input) {
            items {
              id
              activityType
              order {
                id
              }
              transaction {
                id
              }
            }
            pageInfo {
              firstCursor
              lastCursor
            }
            totalItems
          }
        }`,
        variables: { input: {
          pageInput: {
            first: 20,
            last: null,
          },
          chainId: '5',
          expirationType: 'Both',
          walletAddress: '0xf5de760f2e916647fd766B4AD9E85ff943cE3A2b',
        } },
      })

      expect(result.data.getActivities?.items?.[0].activityType).toBe('Purchase')
      expect(result.data.getActivities?.items?.[0].transaction).toBeDefined()
      expect(result.data.getActivities?.items?.[1].order).toBeDefined()
      expect(result.data.getActivities.totalItems).toBe(2)
    })

    it('should skip relations', async () => {
      const result = await testServer.executeOperation({
        query: `query GetActivities($input: TxActivitiesInput) {
          getActivities(input: $input) {
            items {
              id
              activityType
              order {
                id
              }
            }
            pageInfo {
              firstCursor
              lastCursor
            }
            totalItems
          }
        }`,
        variables: { input: {
          activityType: 'Listing',
          pageInput: {
            first: 0,
            last: null,
          },
          skipRelations: true,
          chainId: '5',
          expirationType: 'Both',
        } },
      })

      expect(result.data.getActivities?.items?.[0].activityType).toBe(ActivityType.Listing)
      expect(result.data.getActivities?.items?.[0].order).toBeNull()
      expect(result.data.getActivities.totalItems).toBe(1)
    })

    it('should not return expired items if expirationType is Active', async () => {
      const result = await testServer.executeOperation({
        query: `query GetActivities($input: TxActivitiesInput) {
          getActivities(input: $input) {
            items {
              id
            }
            totalItems
            pageInfo {
              firstCursor
              lastCursor
            }
          }
        }`,
        variables: { input: {
          activityType: 'Listing',
          pageInput: {
            first: 0,
            last: null,
          },
          skipRelations: true,
          chainId: '5',
          expirationType: 'Active',
        } },
      })

      expect(result.data.getActivities?.items).toHaveLength(0)
      expect(result.data.getActivities.totalItems).toBe(0)
    })

    it('should not return expired items if expirationType is Expired', async () => {
      const result = await testServer.executeOperation({
        query: `query GetActivities($input: TxActivitiesInput) {
          getActivities(input: $input) {
            items {
              id
            }
            totalItems
            pageInfo {
              firstCursor
              lastCursor
            }
          }
        }`,
        variables: { input: {
          activityType: 'Listing',
          pageInput: {
            first: 0,
            last: null,
          },
          skipRelations: true,
          chainId: '5',
          expirationType: 'Expired',
        } },
      })

      expect(result.data.getActivities?.items).toHaveLength(1)
      expect(result.data.getActivities.totalItems).toBe(1)
    })

    it('should not return expired items if expirationType is Both', async () => {
      const result = await testServer.executeOperation({
        query: `query GetActivities($input: TxActivitiesInput) {
          getActivities(input: $input) {
            items {
              id
            }
            totalItems
            pageInfo {
              firstCursor
              lastCursor
            }
          }
        }`,
        variables: { input: {
          activityType: 'Listing',
          pageInput: {
            first: 0,
            last: null,
          },
          skipRelations: true,
          chainId: '5',
          expirationType: 'Both',
        } },
      })

      expect(result.data.getActivities?.items).toHaveLength(1)
      expect(result.data.getActivities.totalItems).toBe(1)
    })

    it('should fail if input is missing', async () => {
      const result = await testServer.executeOperation({
        query: `query GetActivities($input: TxActivitiesInput) {
          getActivities(input: $input) {
            items {
              id
              order {
                id
              }
              cancel {
                id
              }
              transaction {
                id
              }
            }
            pageInfo {
              firstCursor
              lastCursor
            }
            totalItems
          }
        }`,
        variables: { },
      })

      expect(result.errors).toBeDefined()
    })

    it('should fail if page input is missing', async () => {
      const result = await testServer.executeOperation({
        query: `query GetActivities($input: TxActivitiesInput) {
          getActivities(input: $input) {
            items {
              id
              order {
                id
              }
              cancel {
                id
              }
              transaction {
                id
              }
            }
            pageInfo {
              firstCursor
              lastCursor
            }
            totalItems
          }
        }`,
        variables: { input: {} },
      })
      expect(result.errors).toBeDefined()
    })
  })

  describe('transaction activity mutations', () => {
    it('should update activities read property', async () => {
      const activityIds: string[] = testData
        .reduce((aggregator: string[], data: any ) => {
          if (data?.activity?.id) {
            aggregator.push(data.activity.id)
          }
          return aggregator
        }, [])
      const result = await testServer.executeOperation({
        query: `mutation UpdateReadByIds($ids: [String]!) {
          updateReadByIds(ids: $ids) {
            updatedIdsSuccess
            idsNotFoundOrFailed
          }
        }`,
        variables: { ids: [...activityIds, 'test-failed-id'] },
      })

      expect(result.data.updateReadByIds.updatedIdsSuccess.length).toEqual(activityIds.length)
      expect(result.data.updateReadByIds.updatedIdsSuccess)
        .toEqual(expect.arrayContaining(activityIds))
      expect(result.data.updateReadByIds.idsNotFoundOrFailed.length).toEqual(1)
      expect(result.data.updateReadByIds.idsNotFoundOrFailed)
        .toEqual(expect.arrayContaining(['test-failed-id']))
    })
  })
  it('should update activities status property', async () => {
    const activityIds: string[] = testData
      .reduce((aggregator: string[], data: any ) => {
        if (data?.activity?.id) {
          aggregator.push(data.activity.id)
        }
        return aggregator
      }, [])
    const result = await testServer.executeOperation({
      query: `mutation UpdateStatusByIds($ids: [String]!, $status: ActivityStatus) {
          updateStatusByIds(ids: $ids, status: $status) {
            updatedIdsSuccess
            idsNotFoundOrFailed
          }
        }`,
      variables: { ids: [...activityIds, 'test-failed-id'], status: 'Executed' },
    })

    expect(result.data.updateStatusByIds.updatedIdsSuccess.length).toEqual(activityIds.length)
    expect(result.data.updateStatusByIds.updatedIdsSuccess)
      .toEqual(expect.arrayContaining(activityIds))
    expect(result.data.updateStatusByIds.idsNotFoundOrFailed.length).toEqual(1)
    expect(result.data.updateStatusByIds.idsNotFoundOrFailed)
      .toEqual(expect.arrayContaining(['test-failed-id']))
  })
})
