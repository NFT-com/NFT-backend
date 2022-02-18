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

const encodeAssetType = (assetClass: string, asset: gql.MarketplaceAssetInput): string => {
  switch (assetClass) {
  case 'ETH':
    return helper.encode(['address'], [helper.AddressZero()])
  case 'ERC20':
    return helper.encode(['address'], [asset.standard.contractAddress])
  case 'ERC721':
  case 'ERC1155':
    return helper.encode(['address', 'uint256', 'bool'], [asset.standard.contractAddress, asset.standard.tokenId, asset.standard.allowAll])
  default:
    return ''
  }
}

// byte validation and returns back asset list
export const getAssetList = (assets: Array<gql.MarketplaceAssetInput>): any => {
  return assets.map((asset: gql.MarketplaceAssetInput) => {
    const assetTypeBytes = encodeAssetType(asset.standard.assetClass, asset)
    const assetBytes = helper.encode(['uint256', 'uint256'], [asset.value, asset.minimumBid])

    // basic validation that bytes match
    if (assetTypeBytes !== asset.standard.bytes) {
      throw Error(`Calculated Asset Type Bytes ${assetTypeBytes} mismatch sent bytes ${asset.standard.bytes}`)
    } else if (assetBytes !== asset.bytes) {
      throw Error(`Calculated Asset Bytes ${assetBytes} mismatch sent bytes ${asset.bytes}`)
    }

    return {
      assetType: {
        assetClass: asset.standard.assetClass,
        data: assetTypeBytes,
      },
      data: assetBytes,
    }
  })
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
