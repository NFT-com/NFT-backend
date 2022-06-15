import { helper } from '@nftcom/shared'

import { gql } from '../defs'
import { validAsk } from '../resolver/marketAsk.resolver'

jest.setTimeout(20000)

describe('marketAsk', () => {
  describe('validAsk', () => {
    it('createAsk args should not be valid', async () => {
      const args = {
        input: {
          structHash: '0xe7337a429f9420dfd9b32b6c1a48667a794e7ae5d6f65ce4bfdd851b52fa39f5',
          nonce: 0,
          auctionType: gql.AuctionType.English,
          signature: {
            v: 27,
            r: '0xde4c2b42703864251ae0a46b4b12aa13e771264781a6b9d41e7517ed7455e65e',
            s: '0x158d0184158ad3a29f0dbf37ef280d581126b47874353611ed5c77a2f57fa171',
          },
          makerAddress: '0xC345420194D9Bac1a4b8f698507Fda9ecB2E3005',
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
          start: 1646348065,
          end: 1656348065,
          salt: 1646348666,
          chainId: '4',
        },
      }
      const chainId = '4'
      const isAskValid = await validAsk(args, chainId)
      expect(isAskValid).toEqual(false)
    })
  })
})
