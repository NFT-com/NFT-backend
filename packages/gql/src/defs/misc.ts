import { ethers } from 'ethers'

import { gql } from '@nftcom/gql/defs'
import { _logger, defs, helper, provider } from '@nftcom/shared'

const logger = _logger.Factory(_logger.Context.General, _logger.Context.GraphQL)

const encodeAssetType = (asset: gql.MarketplaceAssetInput): string => {
  switch (asset.standard.assetClass) {
  case 'ETH':
    return helper.encode(['address'], [helper.AddressZero()])
  case 'ERC20':
    return helper.encode(['address'], [asset.standard.contractAddress])
  case 'ERC721':
  case 'ERC1155':
    return helper.encode(
      ['address', 'uint256', 'bool'],
      [asset.standard.contractAddress, asset.standard.tokenId, asset.standard.allowAll],
    )
  default:
    return ''
  }
}

const encodeAssetClass = (assetClass: gql.AssetClass): string => {
  switch (assetClass) {
  case 'ETH':
    return helper.ETH_ASSET_CLASS
  case 'ERC20':
    return helper.ERC20_ASSET_CLASS
  case 'ERC721':
    return helper.ERC721_ASSET_CLASS
  case 'ERC1155':
    return helper.ERC1155_ASSET_CLASS
  default:
    return ''
  }
}

// byte validation and returns back asset list
export const getAssetList = (assets: Array<gql.MarketplaceAssetInput>): any[] => {
  return assets.map((asset: gql.MarketplaceAssetInput) => {
    const assetTypeBytes = encodeAssetType(asset)
    const assetBytes = helper.encode(['uint256', 'uint256'], [asset.value, asset.minimumBid])

    // basic validation that bytes match
    if (assetTypeBytes !== asset.standard.bytes) {
      throw Error(`Calculated Asset Type Bytes ${assetTypeBytes} mismatch sent bytes ${asset.standard.bytes}`)
    } else if (assetBytes !== asset.bytes) {
      logger.debug(assets)
      throw Error(`Calculated Asset Bytes ${assetBytes} mismatch sent bytes ${asset.bytes}`)
    }

    return {
      assetType: {
        assetClass: encodeAssetClass(asset.standard.assetClass),
        data: assetTypeBytes,
      },
      data: assetBytes,
    }
  })
}

export const convertAssetInput = (assetInput: Array<gql.MarketplaceAssetInput>): Array<gql.MarketplaceAssetInput> => {
  const assets = []
  assetInput.map(asset => {
    let tokenId = ''
    const assetClass = asset.standard.assetClass as defs.AssetClass
    if (assetClass === defs.AssetClass.ERC721 || assetClass === defs.AssetClass.ERC1155)
      tokenId = helper.bigNumberToHex(asset.standard.tokenId)
    assets.push({
      standard: {
        assetClass: assetClass,
        bytes: asset.standard.bytes,
        contractAddress: asset.standard.contractAddress,
        tokenId: tokenId,
        allowAll: asset.standard.allowAll,
      },
      bytes: asset.bytes,
      value: helper.bigNumberToString(asset.value),
      minimumBid: helper.bigNumberToString(asset.minimumBid),
    })
  })

  return assets
}

export const parseNFTIdsFromNativeAsset = (assets: Array<gql.MarketplaceAssetInput>): string[] => {
  const nftIds: string[] = []
  for (const asset of assets) {
    nftIds.push(
      `ethereum/${ethers.utils.getAddress(asset.standard.contractAddress)}/${helper.bigNumberToHex(
        asset.standard.tokenId,
      )}`,
    )
  }
  return nftIds
}

export const parseContractsFromNativeAsset = (assets: Array<gql.MarketplaceAssetInput>): string[] => {
  const contracts: string[] = []
  const seen = {}
  for (const asset of assets) {
    const contract = ethers.utils.getAddress(asset.standard.contractAddress)
    if (!seen[contract]) {
      contracts.push(contract)
      seen[contract] = true
    }
  }
  return contracts
}

export const blockNumberToTimestamp = async (blockNumber: number, chainId: string): Promise<number> => {
  const chainProvider = provider.provider(Number(chainId))
  const block = await chainProvider.getBlock(blockNumber)
  return block.timestamp * 1000
}
