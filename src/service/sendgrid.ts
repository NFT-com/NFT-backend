import sendgrid from '@sendgrid/mail'
import { sgAPIKey } from '@src/config'
import { entity } from '@src/db'
import { _logger, fp } from '@src/helper'

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

export const sendConfirmEmail = (user: entity.User): Promise<unknown> => {
  logger.debug('sendConfirmEmail', { user })
  return send({
    from,
    to: { email: user.email },
    subject: `Your NFT.com email confirm code is ${user.confirmEmailToken}`,
    text: `Your NFT.com email confirm code is ${user.confirmEmailToken}. \n\n[${new Date().toUTCString()}] \n\nThis code expires in 24 hours.`,
  })
}

export const sendReferredBy = (user: entity.User, totalReferrals: number): Promise<unknown> => {
  logger.debug('sendReferredBy', { user })
  return send({
    from,
    to: { email: user.email },
    subject: `New NFT.com Referral! ${new Date().toUTCString()}`,
    text: `A new NFT.com user has signed up using your referral code. \n\n[${new Date().toUTCString()}] \n\nYou have successfully referred ${totalReferrals} users.`,
  })
}
