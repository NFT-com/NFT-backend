import { sgAPIKey } from '@nftcom/gql/config'
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

    return send({
      from,
      to: { email: user.email },
      subject: `Your NFT.com email confirm code is ${user.confirmEmailToken}`,
      text: `Your NFT.com email confirm code is ${user.confirmEmailToken}. \n\n[${new Date().toUTCString()}] \n\nThis code expires in 24 hours.`,
    })
      .then(() => true)
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

// export const sendBidConfirmEmail = (
//   bid: entity.Bid,
//   user: entity.User,
//   profileURL: string,
// ): Promise<boolean> => {
//   if (user?.email) {
//     logger.debug('sendBidConfirm', { bid, user })
//
//     if (helper.isFalse(user.preferences.bidActivityNotifications)) {
//       return Promise.resolve(false)
//     }
//
//     return send({
//       from,
//       to: { email: user.email },
//       dynamicTemplateData: {
//         bidPrice: utils.formatUnits(bid.price, 18),
//         profileURL,
//       },
//       templateId: templates.confirmBid,
//     }).then(() => true)
//   }
// }
//
// export const sendOutbidEmail = (
//   user: entity.User,
//   profileURL: string,
// ): Promise<boolean> => {
//   if (user?.email) {
//     logger.debug('sendOutbid', { user })
//
//     if (helper.isFalse(user?.preferences?.outbidNotifications ?? false)) {
//       return Promise.resolve(false)
//     }
//
//     return send({
//       from,
//       to: { email: user.email },
//       dynamicTemplateData: {
//         profileURL,
//       },
//       templateId: templates.outbid,
//     }).then(() => true)
//   }
// }

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

export const sendBidConfirmEmail = (
  bid: entity.MarketBid,
  seller: entity.User,
): Promise<boolean> => {
  if (seller?.email) {
    logger.debug('sendBidConfirmEmail', { bid, seller })

    if (helper.isFalse(seller.preferences.bidActivityNotifications)) {
      return Promise.resolve(false)
    }

    // TODO: we should have template for marketplace bid confirmation email
    return send({
      from,
      to: { email: seller.email },
      subject: 'Someone has bid on one of your marketplace asset',
      text: `${bid.makerAddress} has bid on one of your marketplace asset.`,
    }).then(() => true)
  }
}

export const sendBuyNowEmail = (
  ask: entity.MarketAsk,
  txHash: string,
  seller: entity.User,
  buyer: entity.User,
): Promise<boolean> => {
  logger.debug('sendBuyNowEmail', { ask, txHash, seller, buyer })
  if (seller.email && helper.isTrue(seller.preferences.purchaseSuccessNotifications)) {
    // TODO: we should have template for marketplace buy now email
    return send({
      from,
      to: { email: seller.email },
      subject: 'Your NFT.com marketplace asset is just sold directly.',
      text: `You can check information on txHash: ${txHash} and https://nft.com/${ask.id}`,
    }).then(() => {
      if (buyer.email && helper.isTrue(buyer.preferences.purchaseSuccessNotifications)) {
        // TODO: we should have template for marketplace buy now email
        return send({
          from,
          to: { email: buyer.email },
          subject: 'You just bought NFT.com marketplace asset directly.',
          text: `You can check information on txHash: ${txHash} and https://nft.com/${ask.id}`,
        }).then(() => true)
      }
    })
  } else {
    if (buyer.email && helper.isTrue(buyer.preferences.purchaseSuccessNotifications)) {
      // TODO: we should have template for marketplace buy now email
      return send({
        from,
        to: { email: buyer.email },
        subject: 'You just bought NFT.com marketplace asset directly.',
        text: `You can check information on txHash: ${txHash} and https://nft.com/${ask.id}`,
      }).then(() => true)
    }
  }
}

export const sendExecuteSwapEmail = (
  ask: entity.MarketAsk,
  bid: entity.MarketBid,
  swap: entity.MarketSwap,
  txHash: string,
  seller: entity.User,
  buyer: entity.User,
): Promise<boolean> => {
  logger.debug('sendExecuteSwapEmail', { ask, bid, swap, txHash })
  if (seller.email && helper.isTrue(seller.preferences.bidActivityNotifications)) {
    // TODO: we should have template for marketplace execute swap email
    return send({
      from,
      to: { email: seller.email },
      subject: 'Your NFT.com marketplace asset is just traded.',
      text: `You can check information on txHash: ${txHash} and askId: ${ask.id}, bidId: ${bid.id}, swapId: ${swap.id}`,
    }).then(() => {
      if (buyer.email && helper.isTrue(buyer.preferences.bidActivityNotifications)) {
        // TODO: we should have template for marketplace execute swap email
        return send({
          from,
          to: { email: buyer.email },
          subject: 'Your NFT.com marketplace asset is just traded.',
          text: `You can check information on txHash: ${txHash} and askId: ${ask.id}, bidId: ${bid.id}, swapId: ${swap.id}`,
        }).then(() => true)
      }
    })
  } else {
    if (buyer.email && helper.isTrue(buyer.preferences.bidActivityNotifications)) {
      // TODO: we should have template for marketplace execute swap email
      return send({
        from,
        to: { email: buyer.email },
        subject: 'Your NFT.com marketplace asset is just traded.',
        text: `You can check information on txHash: ${txHash} and askId: ${ask.id}, bidId: ${bid.id}, swapId: ${swap.id}`,
      }).then(() => true)
    }
  }
}

export const sendAskCancelEmail = (
  ask: entity.MarketAsk,
  txHash: string,
  seller: entity.User,
  bidders: entity.User[],
): Promise<boolean> => {
  logger.debug('sendAskCancelEmail', { ask, txHash, seller })
  if (seller.email && helper.isTrue(seller.preferences.bidActivityNotifications)) {
    // TODO: we should have template for marketplace ask cancel email
    return send({
      from,
      to: { email: seller.email },
      subject: 'You cancelled offer on NFT.com marketplace.',
      text: `You can check information on txHash: ${txHash} and askId: ${ask.id}`,
    }).then(() => {
      return Promise.all(bidders.map((bidder) => {
        if (bidder.email && helper.isTrue(bidder.preferences.bidActivityNotifications)) {
          // TODO: we should have template for marketplace ask cancel email
          return send({
            from,
            to: { email: bidder.email },
            subject: 'Offer on NFT.com marketplace you bid is just canceled',
            text: `You can check information on txHash: ${txHash} and askId: ${ask.id}`,
          })
        }
      })).then(() => true)
    })
  } else {
    return Promise.all(bidders.map((bidder) => {
      if (bidder.email && helper.isTrue(bidder.preferences.bidActivityNotifications)) {
        // TODO: we should have template for marketplace ask cancel email
        return send({
          from,
          to: { email: bidder.email },
          subject: 'Offer on NFT.com marketplace you bid is just canceled',
          text: `You can check information on txHash: ${txHash} and askId: ${ask.id}`,
        })
      }
    })).then(() => true)
  }
}

export const sendBidCancelEmail = (
  bid: entity.MarketBid,
  txHash: string,
  bidder: entity.User,
): Promise<boolean> => {
  logger.debug('sendBidCancelEmail', { bid, txHash, bidder })
  if (bidder.email && helper.isTrue(bidder.preferences.bidActivityNotifications)) {
    // TODO: we should have template for marketplace bid cancel email
    return send({
      from,
      to: { email: bidder.email },
      subject: 'You cancelled bid on NFT.com marketplace.',
      text: `You can check information on txHash: ${txHash} and bidId: ${bid.id}`,
    }).then(() => true)
  }
}

export const sendOutBidEmail = (
  ask: entity.MarketAsk,
  bidders: entity.User[],
): Promise<boolean> => {
  // TODO: outbid works only for single marketplace asset now
  logger.debug('sendOutBidEmail', { ask, bidders })
  const date = new Date(ask.end * 1000)
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const year = date.getFullYear()
  const month = months[date.getMonth()]
  const day = date.getDate()
  const hour = date.getHours()
  const min = date.getMinutes()
  const sec = date.getSeconds()
  const endTime = day + ' ' + month + ' ' + year + ' ' + hour + ':' + min + ':' + sec

  const now = Date.now() / 1000
  const duration = now - ask.end
  const seconds = Math.floor( duration % 60 )
  const minutes = Math.floor( (duration/60) % 60 )
  const hours = Math.floor( (duration/(60*60)) % 24 )
  const days = Math.floor( duration/(60*60*24) )

  return Promise.all(bidders.map((bidder) => {
    if (bidder.email && helper.isTrue(bidder.preferences.outbidNotifications)) {
      // TODO: we should have template for marketplace ask cancel email
      return send({
        from,
        to: { email: bidder.email },
        subject: 'You got outbid on NFT.com marketplace',
        text: `The askId: ${ask.id} and auction ends at ${endTime} and ${days}:${hours}:${minutes}:${seconds} left`,
      })
    }
  })).then(() => true)
}
