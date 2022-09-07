import { Connection } from 'typeorm'

import { testDBConfig } from '@nftcom/gql/config'
import * as testActivityService from '@nftcom/gql/service/txActivity.service'
import { db, entity } from '@nftcom/shared'
import { ActivityStatus, ActivityType, ExchangeType, ProtocolType } from '@nftcom/shared/defs'

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
        '0x47D3ceD01EF669eF085e041f94820EbE368bF27e',
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
        testLooksrareOrder.collectionAddress,
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
      activity.status = ActivityStatus.Valid
      activity.timestamp = new Date()
      activity.walletAddress = '0x47D3ceD01EF669eF085e041f94820EbE368bF27e'
      activity.chainId = '4'
      activity.nftId = [`ethereum/${testLooksrareExistingOrder.collectionAddress}/${testLooksrareExistingOrder.tokenId}`]

      const savedActivity: entity.TxActivity = await repositories.txActivity.save(activity)

      const order: Partial<entity.TxOrder> = await testActivityService.orderEntityBuilder(
        ProtocolType.LooksRare,
        ActivityType.Listing,
        testLooksrareExistingOrder,
        '4',
        testLooksrareExistingOrder.collectionAddress,
      )

      expect(order.activity.id).toBe(savedActivity.id)
      await repositories.txActivity.hardDeleteByIds([savedActivity.id])
    })
  })

  describe('txEntityBuilder', () => {
    it('it builds tx entity correctly', async () => {
      const tx: Partial<entity.TxOrder> = await testActivityService.txEntityBuilder(
        ActivityType.Sale,
        'transactionHash',
        'blockNumber',
        '4',
        '0x47D3ceD01EF669eF085e041f94820EbE368bF27e',
        '123',
        '0x47D3ceD01EF669eF085e041f94820EbE368bF27e',
        '0x47D3ceD01EF669eF085e041f94820EbE368bF27e',
        ExchangeType.LooksRare,
        ProtocolType.LooksRare,
        {
          taker: '0x47D3ceD01EF669eF085e041f94820EbE368bF27e',
          maker: '0x47D3ceD01EF669eF085e041f94820EbE368bF27e',
          currency: '0x47D3ceD01EF669eF085e041f94820EbE368bF27e',
          strategy: '0x47D3ceD01EF669eF085e041f94820EbE368bF27e',
          collection: '0x47D3ceD01EF669eF085e041f94820EbE368bF27e',
        },
        'TakerBid',
      )

      expect(tx.id).toBe('transactionHash')
      expect(tx.activity.activityType).toBe(ActivityType.Sale)
    })

    it('it finds activity if it exists', async () => {
      const activity: entity.TxActivity = new entity.TxActivity()
      activity.activityType = ActivityType.Sale
      activity.activityTypeId = 'transactionHash'
      activity.status = ActivityStatus.Valid
      activity.timestamp = new Date()
      activity.walletAddress = '0x47D3ceD01EF669eF085e041f94820EbE368bF27e'
      activity.chainId = '4'
      activity.nftId = ['ethereum/0x47D3ceD01EF669eF085e041f94820EbE368bF27e/123']

      const savedActivity: entity.TxActivity = await repositories.txActivity.save(activity)

      const tx: Partial<entity.TxTransaction> = await testActivityService.txEntityBuilder(
        ActivityType.Sale,
        'transactionHash',
        'blockNumber',
        '4',
        '0x47D3ceD01EF669eF085e041f94820EbE368bF27e',
        '123',
        '0x47D3ceD01EF669eF085e041f94820EbE368bF27e',
        '0x47D3ceD01EF669eF085e041f94820EbE368bF27e',
        ExchangeType.OpenSea,
        ProtocolType.Seaport,
        {
          offer: [],
          consideration: [],
        },
        'OrderCancelled',
      )

      expect(tx.activity.id).toBe(savedActivity.id)
      await repositories.txActivity.hardDeleteByIds([savedActivity.id])
    })
  })
  describe('cancelEntityBuilder', () => {
    it('it builds cancel entity correctly', async () => {
      const cancelled: Partial<entity.TxOrder> = await testActivityService.cancelEntityBuilder(
        ActivityType.Cancel,
        'transactionHash',
        'blockNumber',
        '4',
        '0x47D3ceD01EF669eF085e041f94820EbE368bF27e',
        ['ethereum/0x47D3ceD01EF669eF085e041f94820EbE368bF27e/1234'],
        '0x47D3ceD01EF669eF085e041f94820EbE368bF27e',
        ExchangeType.LooksRare,
        ActivityType.Listing,
        'order-hash',
      )

      expect(cancelled.id).toBe('transactionHash')
      expect(cancelled.activity.activityType).toBe(ActivityType.Cancel)
    })

    it('it finds activity if it exists', async () => {
      const activity: entity.TxActivity = new entity.TxActivity()
      activity.activityType = ActivityType.Cancel
      activity.activityTypeId = 'transactionHash'
      activity.status = ActivityStatus.Valid
      activity.timestamp = new Date()
      activity.walletAddress = '0x47D3ceD01EF669eF085e041f94820EbE368bF27e'
      activity.chainId = '4'
      activity.nftId = ['ethereum/0x47D3ceD01EF669eF085e041f94820EbE368bF27e/1234']

      const savedActivity: entity.TxActivity = await repositories.txActivity.save(activity)

      const cancel: Partial<entity.TxCancel> = await testActivityService.cancelEntityBuilder(
        ActivityType.Cancel,
        'transactionHash',
        'blockNumber',
        '4',
        '0x47D3ceD01EF669eF085e041f94820EbE368bF27e',
        ['ethereum/0x47D3ceD01EF669eF085e041f94820EbE368bF27e/1234'],
        '0x47D3ceD01EF669eF085e041f94820EbE368bF27e',
        ExchangeType.LooksRare,
        ActivityType.Listing,
        'order-hash',
      )

      expect(cancel.activity.id).toBe(savedActivity.id)
      await repositories.txActivity.hardDeleteByIds([savedActivity.id])
    })
  })
})
