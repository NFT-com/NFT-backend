import { gql } from '@nftcom/gql/defs'
import { db, defs, entity, helper } from '@nftcom/shared'
import { AssetClass } from '@nftcom/shared/defs'

import { PageInfo } from './gql'

export type Pageable<T> = {
  items: T[]
  pageInfo: PageInfo
  totalItems: number
}

export type Context = {
  chain: defs.Chain
  network: string
  repositories: db.Repository
  user: entity.User
  wallet: entity.Wallet
  teamKey?: string
}

export const convertAssetInput = (assetInput: Array<gql.MarketplaceAssetInput>):
Array<gql.MarketplaceAssetInput> =>
{
  const assets = []
  assetInput.map((asset) => {
    assets.push({
      standard: {
        assetClass: asset.standard.assetClass as AssetClass,
        bytes: asset.standard.bytes,
        contractAddress: asset.standard.contractAddress,
        tokenId: helper.bigNumberToString(asset.standard.tokenId),
        allowAll: asset.standard.allowAll,
      },
      bytes: asset.bytes,
      value: helper.bigNumberToString(asset.value),
      minimumBid: helper.bigNumberToString(asset.minimumBid),
    })
  })

  return assets
}
