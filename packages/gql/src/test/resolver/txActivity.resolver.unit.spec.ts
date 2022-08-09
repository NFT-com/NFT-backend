import { Connection } from 'typeorm'

import { testDBConfig } from '@nftcom/gql/config'
import { db } from '@nftcom/shared'
import { TxActivity, TxOrder } from '@nftcom/shared/db/entity'
import { ActivityType, ExchangeType, ProtocolType } from '@nftcom/shared/defs'

import { getTestApolloServer } from '../util/testApolloServer'

jest.setTimeout(300000)
jest.retryTimes(2)

jest.mock('@nftcom/gql/service/cache.service', () => ({
  cache: jest.fn(),
  createCacheConnection: jest.fn(),
}))

const repositories = db.newRepositories()

let testServer
let testData
let connection: Connection

describe('transaction activity resolver', () => {
  beforeAll(async () => {
    connection = await db.connectTestDB(testDBConfig)
    testServer = getTestApolloServer(repositories)
    const timestamp = new Date().getTime()
    testData = await Promise.all(['txOrder', 'txTransaction', 'txCancel'].map(async (table, i) => {
      const orderHash = `${table}-hash`
      let activity = new TxActivity()
      activity.activityType = ActivityType.Listing
      activity.activityTypeId = orderHash
      activity.timestamp = new Date(timestamp + (10000 * i))
      activity.walletId = 'x29hruG3hC0rrkag7ChQb'
      activity.chainId = '4'

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
        activityType.chainId = '4'

        activity = await repositories.txActivity.save(activity)
        activityType.activity = activity
        activityType = await repositories.txOrder.save(activityType)
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
    await connection.close()
  })

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
      variables: { activityType: 'Listing', chainId: '4' },
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

  it('should query activity by wallet id', async () => {
    const result = await testServer.executeOperation({
      query: `query Query($walletId: ID, $chainId: String) { 
        getActivitiesByWalletId(walletId: $walletId, chainId: $chainId) { 
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
      variables: { walletId: testData[0].activity.walletId, chainId: '4' },
    })
    const testDataIds = testData.map(td => td && td.activity.id)
    const activities = result.data?.getActivitiesByWalletId.filter(
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
    expect(activities.length).toBe(testData.filter(td => td !== undefined).length)
  })

  it('should query activity by wallet id and type', async () => {
    const result = await testServer.executeOperation({
      query: `query Query($input: TxWalletIdAndTypeInput) { 
        getActivitiesByWalletIdAndType(input: $input) { 
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
      variables: { input: { walletId: testData[0].activity.walletId, activityType: 'Listing', chainId: '4' } },
    })
    const listData = testData.filter(data => data?.table === 'txOrder')
    const listIds = listData.map(ld => ld.activityType.id)
    const activities = result.data?.getActivitiesByWalletIdAndType.filter(
      activity => activity.order && listIds.includes(activity.order.id))
    for (const activity of activities) {
      expect(activity.activityType).toBe(ActivityType.Listing)
      expect(activity.order.exchange).toBe(ExchangeType.OpenSea)
    }
    expect(activities.length).toBe(listData.length)
  })
})
