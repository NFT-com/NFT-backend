import { utils } from 'ethers'

import { sgAPIKey } from '@nftcom/gql/config'
import { _logger, entity, fp, helper } from '@nftcom/shared'
import sendgrid from '@sendgrid/mail'

sendgrid.setApiKey(sgAPIKey)
const logger = _logger.Factory(
  _logger.Context.SendGrid,
  _logger.Context.General,
)
const from = {
  name: 'NFT.com',
  email: '<noreply@nft.com>',
}

const templates = {
  confirmBid: 'd-c2ac2bc2295049c58b0eb2e1a82cd7e7',
  outbid: 'd-6e92bafc43194eb5a1c8725ecbaaba14',
  winbid: 'd-9e11556ce7f34fbeb66e42f8d3803986',
  watchlist_NftSold: 'd-2b17fd7e18ac460f9b55e9ebe3c45f9d',
  watchlist_NftOwnerChange: 'd-c64f4785ace240959b4558c9ec379055',
  watchlist_NftListingChange: 'd-4a4089e49e55478fb5b135f4236b24e2',
  watchlist_NftNewBid: 'd-ebb2d36052404fe897294030a79cfb6e',
  watchlist_CollectionFloorChange: 'd-4e161ba02de74effa587f154235a7e43',
  watchlist_CollectionAssetSold: 'd-ba6e6e89b005414aa43088cc4a9586f5',
  watchlist_CollectionNewListing: 'd-6988637951fe4093a7263dd7f2e2d8d6',
}

const send = (
  message: sendgrid.MailDataRequired | sendgrid.MailDataRequired[],
): Promise<unknown> => {
  return sendgrid
    .send(message)
    .then(fp.tap((result) => logger.debug('send', { message, result })))
    .catch(fp.tapThrow((err) => logger.error('send', { message, err })))
}

export const sendConfirmEmail = (user: entity.User): Promise<boolean> => {
  if (user?.email) {
    logger.debug('sendConfirmEmail', { user })

    return send({
      from,
      to: { email: user.email },
      subject: `Your NFT.com email confirm code is ${user.confirmEmailToken}`,
      text: `Your NFT.com email confirm code is ${
        user.confirmEmailToken
      }. \n\n[${new Date().toUTCString()}] \n\nThis code expires in 24 hours.`,
    }).then(() => true)
  }
}

export const sendReferredBy = (
  user: entity.User,
  totalReferrals: number,
): Promise<boolean> => {
  if (user?.email) {
    logger.debug('sendReferredBy', { user })
    return send({
      from,
      to: { email: user.email },
      subject: `New NFT.com Referral! ${new Date().toUTCString()}`,
      text: `A new NFT.com user has signed up using your referral code. \n\n[${new Date().toUTCString()}] \n\nYou have successfully referred ${totalReferrals} users.`,
    }).then(() => true)
  }
}

export const sendBidConfirmEmail = (
  bid: entity.Bid,
  user: entity.User,
  profileURL: string,
): Promise<boolean> => {
  if (user?.email) {
    logger.debug('sendBidConfirm', { bid, user })

    if (helper.isFalse(user.preferences.bidActivityNotifications)) {
      return Promise.resolve(false)
    }

    return send({
      from,
      to: { email: user.email },
      dynamicTemplateData: {
        bidPrice: utils.formatUnits(bid.price, 18),
        profileURL,
      },
      templateId: templates.confirmBid,
    }).then(() => true)
  }
}

export const sendOutbidEmail = (
  user: entity.User,
  profileURL: string,
): Promise<boolean> => {
  if (user?.email) {
    logger.debug('sendOutbid', { user })

    if (helper.isFalse(user?.preferences?.outbidNotifications ?? false)) {
      return Promise.resolve(false)
    }

    return send({
      from,
      to: { email: user.email },
      dynamicTemplateData: {
        profileURL,
      },
      templateId: templates.outbid,
    }).then(() => true)
  }
}

export const sendWinEmail = (
  topBid: entity.Bid,
  user: entity.User,
  profileURL: string,
): Promise<boolean> => {
  if (user?.email) {
    logger.debug('sendWinEmail', { user })

    if (
      helper.isFalse(user?.preferences?.purchaseSuccessNotifications ?? false)
    ) {
      return Promise.resolve(false)
    }

    return send({
      from,
      to: { email: user.email },
      dynamicTemplateData: {
        topBid,
        profileURL,
      },
      templateId: templates.winbid,
    }).then(() => true)
  }
}

export const sendMarketplaceBidConfirmEmail = (
  bid: entity.MarketBid,
  user: entity.User,
): Promise<boolean> => {
  if (user?.email) {
    logger.debug('sendMarketplaceBidConfirmEmail', { bid, user })

    if (helper.isFalse(user.preferences.bidActivityNotifications)) {
      return Promise.resolve(false)
    }

    // TODO: we should have template for marketplace bid confirmation email
    return send({
      from,
      to: { email: user.email },
      subject: 'Someone has bid on one of your marketplace asset',
      text: `${bid.makerAddress} has bid on one of your marketplace asset.`,
    }).then(() => true)
  }
}

export const sendNftSoldEmail = (
  user: entity.User,
  nft: entity.NFT,
): Promise<boolean> => {
  if (user.email) {
    logger.debug('sendNftSoldEmail', { user })

    if (helper.isFalse(user.preferences.nftSoldNotifications ?? false)) {
      return Promise.resolve(false)
    }

    return send({
      from,
      to: { email: user.email },
      dynamicTemplateData: {
        nft,
      },
      templateId: templates.watchlist_NftSold,
    }).then(() => true)
  }
}

export const sendNftOwnerChangeEmail = (
  user: entity.User,
  nft: entity.NFT,
): Promise<boolean> => {
  if (user.email) {
    logger.debug('sendNftOwnerChangeEmail', { user })

    if (helper.isFalse(user.preferences.nftOwnerChangeNotifications ?? false)) {
      return Promise.resolve(false)
    }

    return send({
      from,
      to: { email: user.email },
      dynamicTemplateData: {
        nft,
      },
      templateId: templates.watchlist_NftOwnerChange,
    }).then(() => true)
  }
}

export const sendNftListingChangeEmail = (
  user: entity.User,
  nft: entity.NFT,
): Promise<boolean> => {
  if (user.email) {
    logger.debug('sendNftListingChangeEmail', { user })

    if (
      helper.isFalse(user.preferences.nftListingChangeNotifications ?? false)
    ) {
      return Promise.resolve(false)
    }

    return send({
      from,
      to: { email: user.email },
      dynamicTemplateData: {
        nft,
      },
      templateId: templates.watchlist_NftListingChange,
    }).then(() => true)
  }
}

export const sendNftNewBidEmail = (
  user: entity.User,
  nft: entity.NFT,
): Promise<boolean> => {
  if (user.email) {
    logger.debug('sendNftNewBidEmail', { user })

    if (helper.isFalse(user.preferences.nftNewBidNotifications ?? false)) {
      return Promise.resolve(false)
    }

    return send({
      from,
      to: { email: user.email },
      dynamicTemplateData: {
        nft,
      },
      templateId: templates.watchlist_NftNewBid,
    }).then(() => true)
  }
}

export const sendCollectionFloorChangeEmail = (
  user: entity.User,
  collection: entity.Collection,
): Promise<boolean> => {
  if (user.email) {
    logger.debug('sendCollectionFloorChangeEmail', { user })

    if (
      helper.isFalse(
        user.preferences.collectionFloorChangeNotifications ?? false,
      )
    ) {
      return Promise.resolve(false)
    }

    return send({
      from,
      to: { email: user.email },
      dynamicTemplateData: {
        collection,
      },
      templateId: templates.watchlist_CollectionFloorChange,
    }).then(() => true)
  }
}

export const sendCollectionAssetSoldEmail = (
  user: entity.User,
  collection: entity.Collection,
): Promise<boolean> => {
  if (user.email) {
    logger.debug('sendCollectionAssetSoldEmail', { user })

    if (
      helper.isFalse(user.preferences.collectionAssetSoldNotifications ?? false)
    ) {
      return Promise.resolve(false)
    }

    return send({
      from,
      to: { email: user.email },
      dynamicTemplateData: {
        collection,
      },
      templateId: templates.watchlist_CollectionAssetSold,
    }).then(() => true)
  }
}

export const sendCollectionNewListingEmail = (
  user: entity.User,
  collection: entity.Collection,
): Promise<boolean> => {
  if (user.email) {
    logger.debug('sendCollectionNewListingEmail', { user })

    if (
      helper.isFalse(
        user.preferences.collectionNewListingNotifications ?? false,
      )
    ) {
      return Promise.resolve(false)
    }

    return send({
      from,
      to: { email: user.email },
      dynamicTemplateData: {
        collection,
      },
      templateId: templates.watchlist_CollectionNewListing,
    }).then(() => true)
  }
}
