import { DataSource } from 'typeorm'

import { cache } from '@nftcom/cache'
import * as testActivityService from '@nftcom/gql/service/txActivity.service'
import { testDBConfig } from '@nftcom/misc'
import { db, defs, entity } from '@nftcom/shared'
import { ActivityStatus, ActivityType, ExchangeType, ProtocolType } from '@nftcom/shared/defs'

import { testLooksrareExistingOrder, testLooksrareOrder, testSeaportOrder } from '../util/constants'

jest.setTimeout(30000)
jest.mock('@nftcom/cache', () => ({
  redisConfig: {},
  cache: {
    zrevrangebyscore: jest.fn().mockReturnValue(['contract:1']),
    zscore: jest.fn().mockReturnValue(0),
    zadd: jest.fn(),
  },
  CacheKeys: {
    REFRESH_NFT_ORDERS_EXT: 'refresh_nft_orders_ext_test',
    REFRESHED_NFT_ORDERS_EXT: 'refreshed_nft_orders_ext_test',
  },
  createCacheConnection: jest.fn(),
  removeExpiredTimestampedZsetMembers: jest.fn().mockImplementation(() => Promise.resolve(null)),
}))

let connection: DataSource
const repositories = db.newRepositories()

describe('txActivity service', () => {
  beforeAll(async () => {
    connection = await db.connectTestDB(testDBConfig)
  })
  afterAll(async () => {
    if (connection) {
      await connection.destroy()
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
        ProtocolType.LooksRareV2,
        ActivityType.Bid,
        testLooksrareOrder,
        '4',
        testLooksrareOrder.collection,
      )
      expect(order.id).toBe(testLooksrareOrder.hash)
      expect(order.activity.activityType).toBe(ActivityType.Bid)
      expect(order.protocol).toBe(ProtocolType.LooksRareV2)
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
      activity.nftId = [`ethereum/${testLooksrareExistingOrder.collection}/${testLooksrareExistingOrder.itemIds[0]}`]

      const savedActivity: entity.TxActivity = await repositories.txActivity.save(activity)

      const order: Partial<entity.TxOrder> = await testActivityService.orderEntityBuilder(
        ProtocolType.LooksRareV2,
        ActivityType.Listing,
        testLooksrareExistingOrder,
        '4',
        testLooksrareExistingOrder.collection,
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
        ProtocolType.LooksRareV2,
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

  describe('triggerNFTOrderRefreshQueue', () => {
    it('it triggers nft order refresh queue correctly', async () => {
      const nftA: Partial<entity.NFT> = {
        contract: '0xf5de760f2e916647fd766B4AD9E85ff943cE3A2b',
        tokenId: '0x0927b2',
        metadata: {
          name: 'Test A',
          description: 'Test Desc A',
          traits: [],
          imageURL: '',
        },
        type: defs.NFTType.ERC721,
        userId: 'test-user-id-1',
        walletId: 'test-wallet-id-1',
        chainId: '5',
      }

      const nftB: Partial<entity.NFT> = {
        contract: '0x657732980685C29A51053894542D7cb97de144Fe',
        tokenId: '0x0d',
        metadata: {
          name: 'Test B',
          description: 'Test Desc B',
          traits: [],
          imageURL: '',
        },
        type: defs.NFTType.ERC721,
        userId: 'test-user-id-1',
        walletId: 'test-wallet-id-1',
        chainId: '5',
      }

      const nfts: entity.NFT[] = [nftA as entity.NFT, nftB as entity.NFT]
      const chainId = '5'

      const cacheZscoreSpy = jest.spyOn(cache, 'zscore')
      const cacheZaddSpy = jest.spyOn(cache, 'zadd')
      await testActivityService.triggerNFTOrderRefreshQueue(nfts, chainId)
      expect(cacheZscoreSpy).toHaveBeenCalled() // 2 calls for this test
      expect(cacheZaddSpy).toHaveBeenCalled()
    })

    it('it does not zscore when forced', async () => {
      const nftA: Partial<entity.NFT> = {
        contract: '0xf5de760f2e916647fd766B4AD9E85ff943cE3A2c',
        tokenId: '0x0927b1',
        metadata: {
          name: 'Test A',
          description: 'Test Desc A',
          traits: [],
          imageURL: '',
        },
        type: defs.NFTType.ERC721,
        userId: 'test-user-id-1',
        walletId: 'test-wallet-id-1',
        chainId: '5',
      }

      const nftB: Partial<entity.NFT> = {
        contract: '0x657732980685C29A51053894542D7cb97de144Fd',
        tokenId: '0x0e',
        metadata: {
          name: 'Test B',
          description: 'Test Desc B',
          traits: [],
          imageURL: '',
        },
        type: defs.NFTType.ERC721,
        userId: 'test-user-id-1',
        walletId: 'test-wallet-id-1',
        chainId: '5',
      }

      const nfts: entity.NFT[] = [nftA as entity.NFT, nftB as entity.NFT]
      const chainId = '5'

      const cacheZscoreSpy = jest.spyOn(cache, 'zscore')
      const cacheZaddSpy = jest.spyOn(cache, 'zadd')
      await testActivityService.triggerNFTOrderRefreshQueue(nfts, chainId, true)
      expect(cacheZscoreSpy).toHaveBeenCalledTimes(2) // no additional calls for this test
      expect(cacheZaddSpy).toHaveBeenCalled()
    })
  })
})
