
import { Job } from 'bull'

import { _logger, db } from '@nftcom/shared'

// exported for tests
export const repositories = db.newRepositories()
const logger = _logger.Factory(_logger.Context.Misc, _logger.Context.GraphQL)
import { cache, CacheKeys } from '@nftcom/gql/service/cache.service'
import { OpenseaOrderRequest, retrieveMultipleOrdersOpensea } from '@nftcom/gql/service/opensea.service'
import * as Sentry from '@sentry/node'

export const nftExternalOrderRefreshDuration = Number(
  process.env.NFT_EXTERNAL_ORDER_REFRESH_DURATION,
)

export const nftExternalOrders = async (job: Job): Promise<void> => {
  try {
    logger.debug('external orders', job.data)
    const chainId: string = process.env.CHAIN_ID
    const nfts: Array<any> = await repositories.nft.find({ where: { chainId, deletedAt: null } })

    const nftRequest: Array<OpenseaOrderRequest> = nfts.map((nft: any) => ({
      contract: nft.contract,
      tokenId: nft.tokenId,
      chainId: nft.chainId,
    }))
       
    const openseaServiceResponse = await retrieveMultipleOrdersOpensea(nftRequest, chainId, false)

    // to remove
    console.log('response', openseaServiceResponse)

    // @TODO: write to Tx
       
    logger.debug('updated external orders for nfts')
  } catch (err) {
    Sentry.captureMessage(`Error in nftExternalOrders Job: ${err}`)
  }
}

export const nftExternalOrdersOnDemand = async (job: Job): Promise<void> => {
  try {
    logger.debug('external orders on demand', job.data)
    const chainId: string = process.env.CHAIN_ID
    const cachedOrders = await cache.smembers(`${CacheKeys.REFRESH_NFT_ORDERS_EXT}_${process.env.CHAIN_ID}`)
    const nftIdArray: Array<string> = cachedOrders

    if (nftIdArray.length) {
      // process
      // success
      const nfts: Array<any> = await repositories.nft.find({
        where: {
          id: {
            in: nftIdArray,
          },
          chainId,
          deletedAt: null,
        },
      })

      const nftRequest: Array<OpenseaOrderRequest> = nfts.map((nft: any) => ({
        contract: nft.contract,
        tokenId: nft.tokenId,
        chainId: nft.chainId,
      }))

      // request to service
      const openseaServiceResponse = await retrieveMultipleOrdersOpensea(nftRequest, chainId, false)
      // to remove
      console.log('===response====', openseaServiceResponse)

      // @TODO: write to Tx

      await Promise.all([
        cache.sadd(
          `${CacheKeys.REFRESHED_NFT_ORDERS_EXT}_${process.env.CHAIN_ID}`,
          ...cachedOrders,
          'EX',
          Number(nftExternalOrderRefreshDuration) * 60,
        ),
        cache.srem(`${CacheKeys.REFRESH_NFT_ORDERS_EXT}_${process.env.CHAIN_ID}`, ...cachedOrders),
      ])
    }
    // console.log(nftRequest)
     
    logger.debug('updated external orders for nfts - on demand')
  } catch (err) {
    Sentry.captureMessage(`Error in nftExternalOrdersOnDemand Job: ${err}`)
  }
}