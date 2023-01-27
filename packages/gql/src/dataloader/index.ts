import DataLoader from 'dataloader'
// import { BigNumber } from 'ethers'
import { In } from 'typeorm'

import { _logger, db, defs, entity } from '@nftcom/shared'

// import * as Sentry from '@sentry/node'
import { gql, Pageable } from '../defs'
import { pagination } from '../helper'
// import { paginatedActivitiesBy } from '../service/txActivity.service'

// const TEST_WALLET_ID = 'test'
// const logger = _logger.Factory('dataloader', _logger.Context.GraphQL)
const repositories = db.newRepositories()

// create a new loader per request by returing from a function
export const listingsByNFT = new DataLoader<entity.NFT & { args: any }, Pageable<entity.TxActivity>, string>(
  async (keys) => {
    const listings = await repositories.txActivity.findActivitiesForNFTs([...keys], defs.ActivityType.Listing, true)
    console.log(listings)
    return keys.map(({ contract, tokenId, args }) => {
      const keyListings = listings.filter((x) => x.nftId.includes(`ethereum/${contract}/${tokenId}`))
      let pageInput: gql.PageInput = args?.['listingsPageInput']
      if (!pageInput) {
        pageInput = {
          'first': 50,
        }
      }
      const page = pagination.toPageable(
        pageInput,
        keyListings[0],
        keyListings[keyListings.length - 1],
        'createdAt',
      )([keyListings, keyListings.length])
      console.log({ page })
      return page
    })
    // const results = await Promise.allSettled(
    //   keys.map(async ({ walletId, contract, tokenId, chainId, args }) => {
    //     try {
    //       let pageInput: gql.PageInput = args?.['listingsPageInput']
    //       const expirationType: gql.ActivityExpiration = args?.['listingsExpirationType']
    //       const listingsStatus: defs.ActivityStatus = args?.['listingsStatus'] || defs.ActivityStatus.Valid
    //       let listingsOwnerAddress: string = args?.['listingsOwner']
    //       if (!listingsOwnerAddress) {
    //         if (walletId && walletId !== TEST_WALLET_ID) {
    //           // eslint-disable-next-line no-use-before-define
    //           const wallet: entity.Wallet = await walletById.load(walletId)
    //           listingsOwnerAddress = wallet?.address
    //         }
    //       }
    
    //       if (!pageInput) {
    //         pageInput = {
    //           'first': 50,
    //         }
    //       }
    //       chainId ??= process.env.chainId
    
    //       const protocol: gql.ProtocolType = args?.['protocol']
    
    //       if (contract && tokenId) {
    //         const checksumContract = helper.checkSum(contract)
    //         const nftId = `ethereum/${checksumContract}/${BigNumber.from(tokenId).toHexString()}`
    //         let filters: defs.ActivityFilters = {
    //           nftContract: checksumContract,
    //           nftId,
    //           activityType: defs.ActivityType.Listing,
    //           status: listingsStatus,
    //           chainId,
    //         }
    
    //         if (listingsOwnerAddress) {
    //           filters = { ...filters, walletAddress: helper.checkSum(listingsOwnerAddress) }
    //         }
    //         // by default active items are included
    //         if (!expirationType || expirationType === gql.ActivityExpiration.Active) {
    //           filters = { ...filters, expiration: helper.moreThanDate(new Date().toString()) }
    //         } else if (expirationType === gql.ActivityExpiration.Expired){
    //           filters = { ...filters, expiration: helper.lessThanDate(new Date().toString()) }
    //         }
    //         const safefilters = [helper.inputT2SafeK(filters)]
    //         return paginatedActivitiesBy(
    //           repositories.txActivity,
    //           pageInput,
    //           safefilters,
    //           [],
    //           'createdAt',
    //           'DESC',
    //           protocol,
    //         )
    //           .then(pagination.toPageable(pageInput, null, null, 'createdAt'))
    //       }
    //     } catch (err) {
    //       logger.error(`Error in getNFTActivities: ${err}`)
    //       Sentry.captureMessage(`Error in getNFTActivities: ${err}`)
    //       throw err
    //     }
    //   }),
    // )
    // return results.map((result) => (result.status === 'fulfilled' ? result.value : null))
  }, {
    cacheKeyFn: (key) => `${key.walletId}:${key.contract}:${key.tokenId}:${key.chainId}`,
    maxBatchSize: 1,
  },
)

// reuse a loader by creating it once
export const walletById = new DataLoader<string, entity.Wallet>((ids) => {
  return repositories.wallet.find({
    where: { id: In([...ids]) },
  }).then((rows) => ids.map((id) => rows.find((x) => x.id === id)))
})