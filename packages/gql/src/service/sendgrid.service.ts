import { utils } from 'ethers'

import { sgAPIKey } from '@nftcom/gql/config'
import { _logger, entity, fp } from '@nftcom/shared'
import sendgrid from '@sendgrid/mail'

sendgrid.setApiKey(sgAPIKey)
const logger = _logger.Factory(_logger.Context.SendGrid, _logger.Context.General)
const from = {
  name: 'NFT.com',
  email: '<noreply@nft.com>',
}

// TODO use templates

const send = (
  message: sendgrid.MailDataRequired | sendgrid.MailDataRequired[],
): Promise<unknown> => {
  return sendgrid.send(message)
    .then(fp.tap((result) => logger.debug('send', { message, result })))
    .catch(fp.tapThrow((err) => logger.error('send', { message, err })))
}

export const sendConfirmEmail = (user: entity.User): Promise<boolean> => {
  logger.debug('sendConfirmEmail', { user })
  return send({
    from,
    to: { email: user.email },
    subject: `Your NFT.com email confirm code is ${user.confirmEmailToken}`,
    text: `Your NFT.com email confirm code is ${user.confirmEmailToken}. \n\n[${new Date().toUTCString()}] \n\nThis code expires in 24 hours.`,
  })
    .then(() => true)
}

export const sendReferredBy = (user: entity.User, totalReferrals: number): Promise<boolean> => {
  logger.debug('sendReferredBy', { user })
  return send({
    from,
    to: { email: user.email },
    subject: `New NFT.com Referral! ${new Date().toUTCString()}`,
    text: `A new NFT.com user has signed up using your referral code. \n\n[${new Date().toUTCString()}] \n\nYou have successfully referred ${totalReferrals} users.`,
  })
    .then(() => true)
}

export const sendBidConfirmEmail =
  ( bid: entity.Bid, user: entity.User, profileURL: string ): Promise<boolean> => {
    logger.debug('sendBidConfirm', { bid, user })
    return send({
      from,
      to: { email: user.email },
      subject: 'New NFT.com bid!',
      text: 'Your bid is confirmed! ' + utils.formatUnits(bid.price, 18) + ' for nft.com/' + profileURL,
    }).then(() => true)
  }

export const sendOutbidEmail =
  (user: entity.User, profileURL: string ): Promise<boolean> => {
    logger.debug('sendOutbid', { user })
    return send({
      from,
      to: { email: user.email },
      subject: 'You were outbid!',
      text: 'Your bid for nft.com/' + profileURL + ' is now losing',
    }).then(() => true)
  }
