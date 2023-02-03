import { _logger, helper } from '@nftcom/shared'

import { newRepositories } from './db'
import { NFT, TxActivity, TxOrder } from './entity'

const logger = _logger.Factory('search.handler', _logger.Context.TxActivity)
const repositories = newRepositories()

export const getNFTsFromTxOrders = async (orders: TxOrder[]): Promise<NFT[]> => {
  const nfts = []
  const nftsSeen = {}
  for (const order of orders) {
    for (const nftId of order.activity.nftId) {
      if (!nftsSeen[nftId]) {
        const idParts = nftId.split('/')
        if (idParts?.[1] && nftId?.[2]) {
          let csContract = ''
          try {
            csContract = helper.checkSum(idParts[1])
          } catch (err) {
            logger.error(`Contract: ${idParts[1]} is invalid for nft id: ${nftId}. Err: ${err}`)
          }
          const nft = await repositories.nft.findOne({
            where: {
              contract: csContract,
              tokenId: idParts[2],
            },
          })

          if (nft) {
            nfts.push(nft)
          }
          nftsSeen[nftId] = true
        }
      }
    }
  }
  return nfts
}

export const getNFTsFromTxActivities = async (activities: TxActivity[]): Promise<NFT[]> => {
  const nfts = []
  const nftsSeen = {}
  for (const activity of activities) {
    for (const nftId of activity.nftId) {
      if (!nftsSeen[nftId]) {
        const idParts = nftId.split('/')
        if (idParts?.[1] && nftId?.[2]) {
          let csContract = ''
          try {
            csContract = helper.checkSum(idParts[1])
          } catch (err) {
            logger.error(`Contract: ${idParts[1]} is invalid for nft id: ${nftId}. Err: ${err}`)
          }
          const nft = await repositories.nft.findOne({
            where: {
              contract: csContract,
              tokenId: idParts[2],
            },
          })

          if (nft) {
            nfts.push(nft)
          }
          nftsSeen[nftId] = true
        }
      }
    }
  }
  return nfts
}