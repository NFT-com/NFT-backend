import { Connection } from 'typeorm'

import { testDBConfig } from '@nftcom/gql/config'
import { db } from '@nftcom/shared'
import { TxActivity, TxBid, TxList } from '@nftcom/shared/db/entity'
import { ActivityType, ExchangeType } from '@nftcom/shared/defs'

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
    testData = await Promise.all(['txBid', 'txBid', 'txList'].map(async (table, i) => {
      let activity = new TxActivity()
      activity.activityType = table === 'txList' ? ActivityType.Listing : ActivityType[table.slice(2)]
      activity.timestamp = new Date(timestamp + (10000 * i))
      activity.userId = 'x29hruG3hC0rrkag7ChQb'
      activity.chainId = '4'

      let activityType
      switch (table) {
      case 'txBid':
        activityType = new TxBid()
        activityType.addId()
        activityType.activity = activity
        activityType.exchange = ExchangeType.OpenSea
        activityType.orderHash = ''
        activityType.makerAddress = ''
        activityType.offer = []
        activityType.consideration = []
        activityType.chainId = '4'

        activity.activityTypeId = activityType.id
        activity = await repositories.txActivity.save(activity)
        activityType.activity = activity
        activityType = await repositories.txBid.save(activityType)
        break
      case 'txList':
        activityType = new TxList()
        activityType.addId()
        activityType.activity = activity
        activityType.exchange = ExchangeType.LooksRare
        activityType.orderHash = ''
        activityType.makerAddress = ''
        activityType.offer = []
        activityType.consideration = []
        activityType.chainId = '4'

        activity.activityTypeId = activityType.id
        activity = await repositories.txActivity.save(activity)
        activityType.activity = activity
        activityType = await repositories.txList.save(activityType)
        break
      default:
        return
      }
      return Promise.resolve({ table, activity, activityType })
    }))
  })

  afterAll(async () => {
    for (const item of testData) {
      await repositories[item.table].hardDeleteByIds([item.activityType.id])
      await repositories.txActivity.hardDeleteByIds([item.activity.id])
    }
    await testServer.stop()
    if (!connection) return
    await connection.close()
  })

  it('should query activity by type', async () => {
    const result = await testServer.executeOperation({
      query: `query Query($activityType: String, $chainId: String) { 
        getActivitiesByType(activityType: $activityType, chainId: $chainId) { 
          id 
          activityType
          read
          timestamp
          bid {
            id
            exchange
            orderHash
            makerAddress
            offer {
              token
              startAmount
            }
          }
        } 
      }`,
      variables: { activityType: 'Bid', chainId: '4' },
    })
    const bidData = testData.filter(data => data.table === 'txBid')
    const bidIds = bidData.map(bd => bd.activityType.id)
    const activities = result.data?.getActivitiesByType.filter(
      activity => activity.bid && bidIds.includes(activity.bid.id))
    for (const activity of activities) {
      expect(activity.activityType).toBe(ActivityType.Bid)
      expect(activity.bid.exchange).toBe(ExchangeType.OpenSea)
    }
    expect(activities.length).toBe(bidData.length)
  })

  it('should query activity by user id', async () => {
    const result = await testServer.executeOperation({
      query: `query Query($userId: ID, $chainId: String) { 
        getActivitiesByUserId(userId: $userId, chainId: $chainId) { 
          id 
          activityType
          read
          timestamp
          bid {
            id
            exchange
            orderHash
            makerAddress
            offer {
              token
              startAmount
            }
          }
          listing {
            id
            exchange
            orderHash
            makerAddress
            offer {
              token
              startAmount
            }
          }
        } 
      }`,
      variables: { userId: testData[0].activity.userId, chainId: '4' },
    })

    const testDataIds = testData.map(td => td.activity.id)
    const activities = result.data?.getActivitiesByUserId.filter(
      activity => testDataIds.includes(activity.id))
    for (const activity of activities) {
      if (activity.activityType === ActivityType.Bid) {
        expect(activity.bid.exchange).toBe(ExchangeType.OpenSea)
      } else if (activity.activityType === ActivityType.Listing) {
        expect(activity.listing.exchange).toBe(ExchangeType.LooksRare)
      } else {
        fail(`Invalid activity type for test: ${activity.activityType}`)
      }
    }
    expect(activities.length).toBe(testData.length)
  })

  it('should query activity by user id and type', async () => {
    const result = await testServer.executeOperation({
      query: `query Query($input: TxUserIdAndTypeInput) { 
        getActivitiesByUserIdAndType(input: $input) { 
          id 
          activityType
          read
          timestamp
          listing {
            id
            exchange
            orderHash
            makerAddress
            offer {
              token
              startAmount
            }
          }
        } 
      }`,
      variables: { input: { userId: testData[0].activity.userId, activityType: 'Listing', chainId: '4' } },
    })
    const listData = testData.filter(data => data.table === 'txList')
    const listIds = listData.map(ld => ld.activityType.id)
    const activities = result.data?.getActivitiesByUserIdAndType.filter(
      activity => activity.listing && listIds.includes(activity.listing.id))
    for (const activity of activities) {
      expect(activity.activityType).toBe(ActivityType.Listing)
      expect(activity.listing.exchange).toBe(ExchangeType.LooksRare)
    }
    expect(activities.length).toBe(listData.length)
  })
})
