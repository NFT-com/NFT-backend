import { Connection } from 'typeorm'

import { testDBConfig } from '@nftcom/gql/config'
import * as testActivityService from '@nftcom/gql/service/txActivity.service'
import { db, entity } from '@nftcom/shared'
import { ActivityType, ExchangeType, ProtocolType } from '@nftcom/shared/defs'

import { testLooksrareExistingOrder, testLooksrareOrder,testSeaportOrder } from '../util/constants'

jest.setTimeout(30000)
let connection: Connection
const repositories = db.newRepositories()

describe('txActivity service', () => {
  beforeAll(async () => {
    connection = await db.connectTestDB(testDBConfig)
  })
  afterAll(async () => {
    if (connection) {
      await connection.close()
    }
  })
  describe('orderEntityBuilder', () => {
    it('it builds seaport order entity correctly', async () => {
      const order: Partial<entity.TxOrder> = await testActivityService.orderEntityBuilder(
        ProtocolType.Seaport,
        ActivityType.Listing,
        testSeaportOrder,
        '4',
      )

      expect(order.id).toBe(testSeaportOrder.order_hash)
      expect(order.activity.activityType).toBe(ActivityType.Listing)
      expect(order.protocol).toBe(ProtocolType.Seaport)
      expect(order.exchange).toBe(ExchangeType.OpenSea)
    })

    it('it builds looksrare order entity correctly', async () => {
      const order: Partial<entity.TxOrder> = await testActivityService.orderEntityBuilder(
        ProtocolType.LooksRare,
        ActivityType.Bid,
        testLooksrareOrder,
        '4',
      )
      expect(order.id).toBe(testLooksrareOrder.hash)
      expect(order.activity.activityType).toBe(ActivityType.Bid)
      expect(order.protocol).toBe(ProtocolType.LooksRare)
      expect(order.exchange).toBe(ExchangeType.LooksRare)
    })

    it('it finds activity if it exists', async () => {
      const activity: entity.TxActivity = new entity.TxActivity()
      activity.activityType = ActivityType.Listing
      activity.activityTypeId = testLooksrareExistingOrder.hash
      activity.timestamp = new Date()
      activity.walletId = 'x29hruG3hC0rrkag7ChQb'
      activity.chainId = '4'

      const savedActivity: entity.TxActivity = await repositories.txActivity.save(activity)

      const order: Partial<entity.TxOrder> = await testActivityService.orderEntityBuilder(
        ProtocolType.LooksRare,
        ActivityType.Listing,
        testLooksrareExistingOrder,
        '4',
      )

      expect(order.activity.id).toBe(savedActivity.id)
      await repositories.txActivity.hardDeleteByIds([savedActivity.id])
    })
  })
})
