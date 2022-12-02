import { DataSource } from 'typeorm'

import { testDBConfig } from '@nftcom/gql/config'
import { gql } from '@nftcom/gql/defs'
import { testMockUser, testMockWallet } from '@nftcom/gql/test/util/constants'
import { clearDB } from '@nftcom/gql/test/util/helpers'
import { getTestApolloServer } from '@nftcom/gql/test/util/testApolloServer'
import { db, helper } from '@nftcom/shared'

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
    it('should return LISTING_INVALID error', async () => {
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
  })
})
