import { DataSource } from 'typeorm'

import { testDBConfig } from '@nftcom/gql/config'
import { gql } from '@nftcom/gql/defs'
import { testMockUser, testMockWallet } from '@nftcom/gql/test/util/constants'
import { clearDB } from '@nftcom/gql/test/util/helpers'
import { getTestApolloServer } from '@nftcom/gql/test/util/testApolloServer'
import { db, defs,helper } from '@nftcom/shared'
import { TxActivity, TxOrder } from '@nftcom/shared/db/entity'

jest.setTimeout(300000)
jest.retryTimes(2)

let testServer
const repositories = db.newRepositories()
let connection: DataSource

describe('trading', () => {
  beforeAll(async () => {
    connection = await db.connectTestDB(testDBConfig)
  })

  afterAll(async () => {
    if (!connection) return
    await connection.destroy()
  })

  describe('createMarketListing', () => {
    beforeAll(async () => {
      testServer = getTestApolloServer(repositories,
        testMockUser,
        testMockWallet,
      )
    })

    afterAll(async () => {
      await clearDB(repositories)
      await testServer.stop()
    })
    it('should throw LISTING_INVALID error', async () => {
      const result = await testServer.executeOperation({
        query: 'mutation CreateMarketListing($input: CreateListingInput!) { createMarketListing(input: $input) { orderHash } }',
        variables: {
          input: {
            structHash: '0xe7337a429f9420dfd9b32b6c1a48667a794e7ae5d6f65ce4bfdd851b52fa39f5',
            nonce: 0,
            auctionType: gql.AuctionType.English,
            signature: {
              v: 27,
              r: '0xde4c2b42703864251ae0a46b4b12aa13e771264781a6b9d41e7517ed7455e65e',
              s: '0x158d0184158ad3a29f0dbf37ef280d581126b47874353611ed5c77a2f57fa171',
            },
            makerAddress: '0xf5de760f2e916647fd766B4AD9E85ff943cE3A2b',
            makeAsset: [
              {
                standard: {
                  assetClass: gql.AssetClass.ERC721,
                  bytes: '0x000000000000000000000000f5de760f2e916647fd766b4ad9e85ff943ce3a2b0000000000000000000000000000000000000000000000000000000000029fdc0000000000000000000000000000000000000000000000000000000000000000',
                  contractAddress: '0xf5de760f2e916647fd766B4AD9E85ff943cE3A2b',
                  tokenId: helper.bigNumberToHex(171996),
                  allowAll: true,
                },
                bytes: '0x00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000',
                value: helper.bigNumberToHex(1),
                minimumBid: helper.bigNumberToHex(0),
              },
            ],
            takerAddress: '0x0000000000000000000000000000000000000000',
            takeAsset: [],
            start: 1669970260,
            end: 1679970260,
            salt: 1669970261,
            chainId: '5',
          },
        },
      })

      expect(result.errors.length).toEqual(1)
    })

    it.only('should save new listing', async () => {
      const testMockWallet1 = testMockWallet
      testMockWallet1.chainId = '5'
      testMockWallet1.address = '0xd1D9F52d63e3736908c6e7D868f785d30Af5e3AC'
      testServer = getTestApolloServer(repositories,
        testMockUser,
        testMockWallet1,
      )
      const result = await testServer.executeOperation({
        query: 'mutation CreateMarketListing($input: CreateListingInput!) { createMarketListing(input: $input) { orderHash } }',
        variables: {
          input: {
            structHash: '0x26e849613d1e565d24b9a76fc66b7d121f68e943e89a4a3ad315055592c10399',
            nonce: 0,
            auctionType: gql.AuctionType.FixedPrice,
            signature: {
              v: 27,
              r: '0xc40cdc01d22bd0964e40cb2982f4b8716c358ce45d245ba41d1104aad7eaf96d',
              s: '0x2d71b091419e3ca364b621d3b1ea002aec5f0d7e9c2bf1c99340e5848919bd7b',
            },
            makerAddress: '0xd1D9F52d63e3736908c6e7D868f785d30Af5e3AC',
            makeAsset: [
              {
                standard: {
                  assetClass: gql.AssetClass.ERC721,
                  bytes: '0x0000000000000000000000009ef7a34dccc32065802b1358129a226b228dab4e000000000000000000000000000000000000000000000000000000000000003e0000000000000000000000000000000000000000000000000000000000000000',
                  contractAddress: '0x9Ef7A34dcCc32065802B1358129a226B228daB4E',
                  tokenId: '0x3e',
                  allowAll: false,
                },
                bytes: '0x00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000',
                value: '0x01',
                minimumBid: '0x00',
              },
            ],
            takerAddress: '0x0000000000000000000000000000000000000000',
            takeAsset: [
              {
                standard: {
                  assetClass: gql.AssetClass.ERC20,
                  bytes: '0x0000000000000000000000000000000000000000000000000000000000000000',
                  contractAddress: '0x0000000000000000000000000000000000000000',
                  tokenId: '0',
                  allowAll: false,
                },
                bytes: '0x0000000000000000000000000000000000000000000000000de0b6b3a76400000000000000000000000000000000000000000000000000000de0b6b3a7640000',
                value: '0x0de0b6b3a7640000',
                minimumBid: '0x0de0b6b3a7640000',
              },
            ],
            start: 1673286526,
            end: 1673373526,
            salt: 1673287126,
            chainId: '5',
          },
        },
      })

      expect(result.data.createMarketListing.orderHash).toBeDefined()
    })
  })

  describe('createMarketBid', () => {
    beforeAll(async () => {
      testServer = getTestApolloServer(repositories,
        testMockUser,
        testMockWallet,
      )

      // active activity
      let activity = new TxActivity()
      activity.activityType = defs.ActivityType.Listing
      activity.activityTypeId = '0x2d74e716df63ecd1c815443c0d86711985e03901119e6a4b22800ca7857c25df'
      activity.status = defs.ActivityStatus.Valid
      activity.timestamp = new Date()
      const currentDate: Date = new Date()
      currentDate.setDate(currentDate.getDate() + 1)
      activity.expiration = currentDate
      activity.walletAddress = testMockWallet.address
      activity.nftContract ='0x'
      activity.nftId = []
      activity.chainId = '5'

      // active order
      let activityType = new TxOrder()
      activityType.id = '0x2d74e716df63ecd1c815443c0d86711985e03901119e6a4b22800ca7857c25df'
      activityType.activity = activity
      activityType.exchange = defs.ExchangeType.NFTCOM
      activityType.orderHash = '0x2d74e716df63ecd1c815443c0d86711985e03901119e6a4b22800ca7857c25df'
      activityType.orderType = defs.ActivityType.Listing
      activityType.makerAddress = testMockWallet.address
      activityType.protocol = defs.ProtocolType.NFTCOM
      activityType.protocolData = {}
      activityType.chainId = '5'

      activity = await repositories.txActivity.save(activity)
      activityType.activity = activity
      activityType = await repositories.txOrder.save(activityType)
    })

    afterAll(async () => {
      await clearDB(repositories)
      await testServer.stop()
    })
    xit('should throw MARKET_BID_INVALID error', async () => {
      const result = await testServer.executeOperation({
        query: 'mutation CreateMarketBid($input: CreateBidInput!) { createMarketBid(input: $input) { orderHash } }',
        variables: {
          input: {
            structHash: '0xe7337a429f9420dfd9b32b6c1a48667a794e7ae5d6f65ce4bfdd851b52fa39f5',
            nonce: 0,
            auctionType: gql.AuctionType.English,
            signature: {
              v: 27,
              r: '0xde4c2b42703864251ae0a46b4b12aa13e771264781a6b9d41e7517ed7455e65e',
              s: '0x158d0184158ad3a29f0dbf37ef280d581126b47874353611ed5c77a2f57fa171',
            },
            listingId: '0x2d74e716df63ecd1c815443c0d86711985e03901119e6a4b22800ca7857c25df',
            makerAddress: '0xf5de760f2e916647fd766B4AD9E85ff943cE3A2b',
            makeAsset: [
              {
                standard: {
                  assetClass: gql.AssetClass.ERC721,
                  bytes: '0x000000000000000000000000f5de760f2e916647fd766b4ad9e85ff943ce3a2b0000000000000000000000000000000000000000000000000000000000029fdc0000000000000000000000000000000000000000000000000000000000000000',
                  contractAddress: '0xf5de760f2e916647fd766B4AD9E85ff943cE3A2b',
                  tokenId: helper.bigNumberToHex(171996),
                  allowAll: true,
                },
                bytes: '0x00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000',
                value: helper.bigNumberToHex(1),
                minimumBid: helper.bigNumberToHex(0),
              },
            ],
            takerAddress: '0x0000000000000000000000000000000000000000',
            takeAsset: [],
            start: 1669970260,
            end: 1679970260,
            salt: 1669970261,
            chainId: '5',
            message: 'Test bid',
          },
        },
      })

      expect(result.errors.length).toEqual(1)
    })
  })
})
