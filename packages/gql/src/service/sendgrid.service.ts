import { utils } from 'ethers'
import fetch from 'isomorphic-unfetch'
import { encode } from 'url-encode-decode'

import { confirmEmailUrl, sgAPIKey } from '@nftcom/gql/config'
import { _logger, entity, fp, helper } from '@nftcom/shared'
import sendgrid from '@sendgrid/mail'

sendgrid.setApiKey(sgAPIKey)
const logger = _logger.Factory(_logger.Context.SendGrid, _logger.Context.General)
const from = {
  name: 'NFT.com',
  email: '<noreply@nft.com>',
}

const templates = {
  confirmBid: 'd-c2ac2bc2295049c58b0eb2e1a82cd7e7',
  outbid: 'd-6e92bafc43194eb5a1c8725ecbaaba14',
  winbid: 'd-9e11556ce7f34fbeb66e42f8d3803986',
  sendConfirmEmail: 'd-f11f18c741e84e7f9c50e93eceb7a9a2',
  confirmedEmailSuccess: 'd-fad5182e6dfc42deaa2d1f6084feb687',
}

const send = (
  message: sendgrid.MailDataRequired | sendgrid.MailDataRequired[],
): Promise<unknown> => {
  return sendgrid.send(message)
    .then(fp.tap((result) => logger.debug('send', { message, result })))
    .catch(fp.tapThrow((err) => logger.error('send', { message, err })))
}

export const sendConfirmEmail = (user: entity.User): Promise<boolean> => {
  if (user?.email) {
    logger.debug('sendConfirmEmail', { user })
    const baseUrl = confirmEmailUrl

    return send({
      from,
      to: { email: user.email },
      dynamicTemplateData: {
        confirmEmailLink: `${baseUrl}/app/confirm-email?email=${encode(user.email)}&token=${encode(user.confirmEmailToken)}`,
      },
      templateId: templates.sendConfirmEmail,
    }).then(() => true)
  }
}

export const sendSuccessSubscribeEmail = (email: string): Promise<boolean> => {
  if (email) {
    return send({
      from,
      to: { email: email },
      dynamicTemplateData: {},
      templateId: templates.confirmedEmailSuccess,
    }).then(() => true)
  }
}

export const sendReferralEmail = async (
  email: string,
  referralId: string,
  profileUrl: string,
): Promise<boolean> => {
  // TODO: text should be replaced with HTML template
  const text = `Hey there,\n\nYour friend ${profileUrl} has invited you to create your NFT Profile at NFT.com!` +
    '\n\nNFT.com is the social NFT marketplace. We’re bringing artists, collectors, creators and fans\n\n together, ' +
    'providing them the tools they need to buy, sell, display, and engage with NFTs.' +
    '\n\nYour NFT Profile is exactly that, yours. We’ve had enough of social networks that exploit their\n\n users. ' +
    'Creating your profile enables you to establish and own your digital identity. ' +
    'You can collect\n\n and display new NFTs or promote your latest NFT collection.' +
    `\n\nCreate your free NFT Profile: ${confirmEmailUrl}?referralCode=${referralId}&referralUrl=${profileUrl}` +
    '\n\nYou’ll be able to customize your NFT Profile, grow your network and collect new NFTs on NFT.com' +
    '\n\nSee you in the metaverse,\n\nNFT.com Team'
  try {
    await send({
      from,
      to: { email },
      subject: `${profileUrl} has invited you to join them on NFT.com.`,
      text,
    })
    return true
  } catch (err) {
    logger.error(`Something went wrong with sending referral email: ${err}`)
    return false
  }
}

export const sendReferredBy = (user: entity.User, totalReferrals: number): Promise<boolean> => {
  if (user?.email) {
    logger.debug('sendReferredBy', { user })
    return send({
      from,
      to: { email: user.email },
      subject: `New NFT.com Referral! ${new Date().toUTCString()}`,
      text: `A new NFT.com user has signed up using your referral code. \n\n[${new Date().toUTCString()}] \n\nYou have successfully referred ${totalReferrals} users.`,
    })
      .then(() => true)
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

    if (helper.isFalse(user?.preferences?.purchaseSuccessNotifications ?? false)) {
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

export const addEmailToList = async (
  email: string,
  list_ids: string[] = ['0b66c181-cc06-4ebd-9d8d-6a7ec7b3d3c3'], // Hompage V2 Subscribe
): Promise<boolean> => {
  try {
    await fetch('https://api.sendgrid.com/v3/marketing/contacts', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sgAPIKey}`,
      },
      body: JSON.stringify({
        list_ids,
        contacts: [{ 'email': email?.toLowerCase() }],
      }),
    })

    return true
  } catch (err) {
    return false
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
