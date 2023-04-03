import DataLoader from 'dataloader'

import { _logger, db, defs, entity } from '@nftcom/shared'

import { gql, Pageable } from '../defs'
import { pagination } from '../helper'
import { wallet } from './wallet'

const repositories = db.newRepositories()

const TEST_WALLET_ID = 'test'
const nftsToListingsFn = (listings: entity.TxActivity[], wallets: entity.Wallet[]) => {
  return ({
    contract,
    tokenId,
    walletId,
    owner,
    args: { listingsOwner, listingsPageInput },
  }): Pageable<entity.TxActivity> => {
    let listingsOwnerAddress: string = listingsOwner
    if (!listingsOwnerAddress) {
      if (owner) {
        listingsOwnerAddress = owner
      } else if (walletId && walletId !== TEST_WALLET_ID) {
        const wallet: entity.Wallet = wallets.find(wallet => wallet.id === walletId)
        listingsOwnerAddress = wallet?.address
      }
    }
    const keyListings = listings.filter(
      listing =>
        listing.nftId.includes(`ethereum/${contract}/${tokenId}`) &&
        (!listingsOwnerAddress || listing.walletAddress === listingsOwnerAddress),
    )

    let pageInput: gql.PageInput = listingsPageInput
    if (!pageInput) {
      pageInput = {
        first: 50,
      }
    }
    const page = pagination.toPageable(
      pageInput,
      keyListings[0],
      keyListings[keyListings.length - 1],
      'createdAt',
    )([keyListings, keyListings.length])
    return page
  }
}

export const listingsByNFT = new DataLoader<entity.NFT & { args: any }, Pageable<entity.TxActivity>, string>(
  async keys => {
    const listings = await repositories.txActivity.findActivitiesForNFTs([...keys], defs.ActivityType.Listing, {
      notExpired: true,
    })
    const wallets = (await wallet.loadMany(keys.map(k => k.walletId).filter(x => !!x))) as entity.Wallet[]
    return keys.map(nftsToListingsFn(listings, wallets))
  },
  {
    cache: false,
  },
)

export const listingsByNFTCancelled = new DataLoader<entity.NFT & { args: any }, Pageable<entity.TxActivity>, string>(
  async keys => {
    const listings = await repositories.txActivity.findActivitiesForNFTs([...keys], defs.ActivityType.Listing, {
      activityStatus: defs.ActivityStatus.Cancelled,
      notExpired: true,
    })
    const wallets = (await wallet.loadMany(keys.map(k => k.walletId).filter(x => !!x))) as entity.Wallet[]
    return keys.map(nftsToListingsFn(listings, wallets))
  },
  {
    cache: false,
  },
)

export const listingsByNFTExecuted = new DataLoader<entity.NFT & { args: any }, Pageable<entity.TxActivity>, string>(
  async keys => {
    const listings = await repositories.txActivity.findActivitiesForNFTs([...keys], defs.ActivityType.Listing, {
      activityStatus: defs.ActivityStatus.Executed,
      notExpired: true,
    })
    const wallets = (await wallet.loadMany(keys.map(k => k.walletId).filter(x => !!x))) as entity.Wallet[]
    return keys.map(nftsToListingsFn(listings, wallets))
  },
  {
    cache: false,
  },
)

export const listingsByNFTExpired = new DataLoader<entity.NFT & { args: any }, Pageable<entity.TxActivity>, string>(
  async keys => {
    const listings = await repositories.txActivity.findActivitiesForNFTs([...keys], defs.ActivityType.Listing, {
      expiredOnly: true,
    })
    const wallets = (await wallet.loadMany(keys.map(k => k.walletId).filter(x => !!x))) as entity.Wallet[]
    return keys.map(nftsToListingsFn(listings, wallets))
  },
  {
    cache: false,
  },
)

export const listingsByNFTExpiredAndCancelled = new DataLoader<
  entity.NFT & { args: any },
  Pageable<entity.TxActivity>,
  string
>(
  async keys => {
    const listings = await repositories.txActivity.findActivitiesForNFTs([...keys], defs.ActivityType.Listing, {
      activityStatus: defs.ActivityStatus.Cancelled,
      expiredOnly: true,
    })
    const wallets = (await wallet.loadMany(keys.map(k => k.walletId).filter(x => !!x))) as entity.Wallet[]
    return keys.map(nftsToListingsFn(listings, wallets))
  },
  {
    cache: false,
  },
)

export const listingsByNFTExpiredAndExecuted = new DataLoader<
  entity.NFT & { args: any },
  Pageable<entity.TxActivity>,
  string
>(
  async keys => {
    const listings = await repositories.txActivity.findActivitiesForNFTs([...keys], defs.ActivityType.Listing, {
      activityStatus: defs.ActivityStatus.Executed,
      expiredOnly: true,
    })
    const wallets = (await wallet.loadMany(keys.map(k => k.walletId).filter(x => !!x))) as entity.Wallet[]
    return keys.map(nftsToListingsFn(listings, wallets))
  },
  {
    cache: false,
  },
)
