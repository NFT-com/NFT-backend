import crypto from 'crypto'
import { differenceInSeconds, isEqual } from 'date-fns'
import abi from 'ethereumjs-abi'
import { combineResolvers } from 'graphql-resolvers'
import Joi from 'joi'
import Web3 from 'web3'

import { appError, mintError, profileError, userError } from '@nftcom/error-types'
import { serverConfigVar } from '@nftcom/misc'
import { Context } from '@nftcom/misc'
import { auth, joi, pagination } from '@nftcom/misc'
import { core, sendgrid } from '@nftcom/service'
import { _logger, contracts, defs, entity, fp, helper, provider, typechain } from '@nftcom/shared'

import { gql } from '../defs'

const web3 = new Web3()
const logger = _logger.Factory(_logger.Context.Bid, _logger.Context.GraphQL)

const sendBidNotifications = (
  newBid: entity.Bid,
  prevTopBidOwner: entity.User,
  newBidOwner: entity.User,
  profileURL: string,
): Promise<[boolean, boolean]> =>
  Promise.all([
    sendgrid.sendBidConfirmEmail(newBid, newBidOwner, profileURL),
    sendgrid.sendOutbidEmail(prevTopBidOwner, profileURL),
  ])

const bid = (_: any, args: gql.MutationBidArgs, ctx: Context): Promise<gql.Bid> => {
  const { user, repositories, wallet } = ctx
  logger.debug('bid', { loggedInUserId: user.id, input: args.input })

  const schema = Joi.object().keys({
    nftType: Joi.string()
      .required()
      .valid(...Object.values(gql.NFTType)),
    price: Joi.required().custom(joi.buildBigNumber),
    profileURL: Joi.string(),
    signature: joi.buildSignatureInputSchema(),
    wallet: joi.buildWalletInputSchema(),
  })
  const { input } = args
  joi.validateSchema(schema, input)

  if (input.nftType === gql.NFTType.Profile && helper.isEmpty(input.profileURL)) {
    throw appError.buildInvalidSchema(new Error('profileURL is required'))
  }

  if (
    (input.nftType === gql.NFTType.GenesisKey &&
      /* 4/26/2022, 7:00:00 PM in Milliseconds */
      1651014000000 > new Date().getTime()) ||
    /* 4/28/2022, 7:00:00 PM in Milliseconds */
    1651186800000 < new Date().getTime()
  ) {
    throw appError.buildForbidden('Auction is not live.')
  }

  return core
    .getWallet(ctx, input.wallet)
    .then(({ id: walletId }) => {
      if (input.nftType !== gql.NFTType.Profile) {
        return { walletId, profileId: null }
      }

      // create profile if it doesn't exist
      return core
        .createProfile(ctx, { url: input.profileURL, chainId: wallet.chainId })
        .then(({ id }) => ({ walletId, profileId: id }))
    })
    .then(async ({ profileId, walletId }) => {
      if (input.nftType === gql.NFTType.GenesisKey) {
        const whitelist = helper.getGenesisKeyWhitelist()
        const ofacBool = core.OFAC[wallet.address]

        const lowercasedWhitelist = whitelist.map(address => {
          try {
            return address?.toLowerCase()
          } catch (e) {
            return address
          }
        })

        if (ofacBool) {
          throw appError.buildForbidden(`${wallet.address} is on OFAC`)
        } else {
          if (lowercasedWhitelist.includes(wallet.address.toLowerCase())) {
            return repositories.bid
              .findOne({
                where: {
                  nftType: gql.NFTType.GenesisKey,
                  walletId,
                },
              })
              .then(previousGKBid => ({
                walletId,
                profileId,
                stakeWeight: null,
                existingBid: previousGKBid,
                prevTopBidOwner: null,
              }))
          } else {
            const ensList = helper.getEnsKeyWhitelist()
            const ensAddress = await core.convertEthAddressToEns(wallet.address)
            if (ensList.includes(ensAddress)) {
              return repositories.bid
                .findOne({
                  where: {
                    nftType: gql.NFTType.GenesisKey,
                    walletId,
                  },
                })
                .then(previousGKBid => ({
                  walletId,
                  profileId,
                  stakeWeight: null,
                  existingBid: previousGKBid,
                  prevTopBidOwner: null,
                }))
            } else {
              throw appError.buildForbidden(`${wallet.address} is not whitelisted`)
            }
          }
        }
      } else if (input.nftType !== gql.NFTType.Profile) {
        // TODO: find bid and prevTopBid for non-profile NFTs too.
        return { walletId, profileId, stakeWeight: null, existingBid: null, prevTopBidOwner: null }
      }

      // calculate stake weight seconds for Profile bids
      return repositories.bid.findRecentBidByProfileUser(profileId, user.id).then(existingBid => {
        const now = helper.toUTCDate()
        const existingUpdateTime = existingBid?.updatedAt || now
        const existingStake = existingBid?.price || 0
        const existingStakeWeight = existingBid?.stakeWeightedSeconds || 0
        const curSeconds = isEqual(now, existingUpdateTime) ? 0 : differenceInSeconds(now, existingUpdateTime)
        const bigNumStake = helper.bigNumber(existingStake).div(helper.tokenDecimals)
        const stakeWeight = existingStakeWeight + curSeconds * Number(bigNumStake)
        return {
          walletId,
          profileId,
          stakeWeight,
          existingBid,
          prevTopBidOwner: repositories.bid
            .findTopBidByProfile(profileId)
            .then(fp.thruIfNotEmpty(prevTopBid => repositories.user.findById(prevTopBid.userId))),
        }
      })
    })
    .then(({ profileId, walletId, stakeWeight, existingBid, prevTopBidOwner }) => {
      return Promise.all([
        repositories.bid.save({
          id: existingBid?.id,
          nftType: input.nftType,
          price: helper.bigNumberToString(input.price),
          profileId,
          signature: input.signature,
          stakeWeightedSeconds: stakeWeight,
          status: gql.BidStatus.Submitted,
          userId: user.id,
          walletId,
        }),
        prevTopBidOwner,
      ])
    })
    .then(
      fp.tapIf(([newBid]) => newBid.nftType === defs.NFTType.Profile)(([newBid, prevTopBidOwner]) =>
        sendBidNotifications(newBid, prevTopBidOwner, user, input.profileURL),
      ),
    )
    .then(([newBid]) => newBid)
}

// const getBids = (
//   _: any,
//   args: gql.QueryBidsArgs,
//   ctx: Context,
// ): Promise<gql.BidsOutput> => {
//   const { user, repositories } = ctx
//   logger.debug('getBids', { loggedInUserId: user?.id, input: args?.input })
//   const pageInput = args?.input?.pageInput

//   // TODO (eddie): add support for querying all public
//   // bids for a user, given one of their wallet's details.

//   return Promise.resolve(args?.input?.wallet)
//     .then(fp.thruIfNotEmpty((walletInput) => {
//       return repositories.wallet.findByNetworkChainAddress(
//         walletInput.network,
//         walletInput.chainId,
//         walletInput.address,
//       )
//     }))
//     .then((wallet: entity.Wallet) => {
//       const inputFilters = {
//         profileId: args?.input?.profileId,
//         walletId: wallet?.id,
//         nftType: args?.input?.nftType,
//       }
//       const filters = [helper.inputT2SafeK(inputFilters)]
//       return core.paginatedEntitiesBy(
//         ctx.repositories.bid,
//         pageInput,
//         filters,
//         [], // relations
//       )
//     })
//     .then(pagination.toPageable(pageInput))
// }

const getMyBids = (_: any, args: gql.QueryMyBidsArgs, ctx: Context): Promise<gql.BidsOutput> => {
  const { user } = ctx
  logger.debug('getMyBids', { loggedInUserId: user.id, input: args?.input })
  const pageInput = args?.input?.pageInput
  const filters = [helper.inputT2SafeK<entity.Bid>({ ...args?.input, userId: user.id })]
  return core
    .paginatedEntitiesBy(
      ctx.repositories.bid,
      pageInput,
      filters,
      [], // relations
    )
    .then(pagination.toPageable(pageInput))
}

const signHash = (_: any, args: gql.MutationSignHashArgs, ctx: Context): Promise<gql.SignHashOutput> => {
  const privateKey = process.env.PUBLIC_SALE_KEY

  const { user, xMintSignature } = ctx

  logger.debug('signHash', { loggedInUserId: user.id, input: args.input, xMintSignature })

  const schema = Joi.object().keys({
    timestamp: Joi.string(),
  })
  const { input } = args
  joi.validateSchema(schema, input)

  if (!xMintSignature) {
    throw userError.buildAuth()
  } else {
    return ctx.repositories.wallet
      .findByUserId(user.id)
      .then(fp.rejectIfEmpty(appError.buildNotFound(mintError.buildWalletEmpty(), mintError.ErrorType.WalletEmpty)))
      .then(wallet => {
        const hmac = crypto.createHmac('sha256', String(process.env.SHARED_MINT_SECRET))
        const { timestamp } = input
        const inputObject = {
          address: wallet[0]?.address?.toLowerCase(),
          timestamp,
        }
        const calculatedSignature = hmac.update(JSON.stringify(inputObject)).digest('hex')

        if (xMintSignature != calculatedSignature) {
          throw userError.buildAuth()
        } else {
          const hash = '0x' + abi.soliditySHA3(['string'], [xMintSignature]).toString('hex')

          const sigObj = web3.eth.accounts.sign(hash, privateKey)

          return {
            hash: sigObj.messageHash,
            signature: sigObj.signature,
          }
        }
      })
  }
}

const signHashProfile = (_: any, args: gql.MutationSignHashProfileArgs, ctx: Context): Promise<gql.SignHashOutput> => {
  const privateKey = process.env.PUBLIC_SALE_KEY
  const { user } = ctx

  const reserved = core.reservedProfiles
  const flattenedReserveList = [].concat(...Object.values(reserved))
  const resevedMap = new Map(
    flattenedReserveList.map(object => {
      return [object, true]
    }),
  )

  return ctx.repositories.wallet
    .findByUserId(user.id)
    .then(fp.rejectIfEmpty(appError.buildNotFound(mintError.buildWalletEmpty(), mintError.ErrorType.WalletEmpty)))
    .then(wallet => {
      if (resevedMap.get(args?.profileUrl?.toLowerCase())) {
        const potentialInsider = reserved[helper.checkSum(wallet[0]?.address)]

        if (!potentialInsider || potentialInsider.indexOf(args?.profileUrl?.toLowerCase()) == -1) {
          throw appError.buildExists(
            profileError.buildProfileInvalidReserveMsg(args?.profileUrl?.toLowerCase()),
            profileError.ErrorType.ProfileInvalid,
          )
        }
      }

      if (core.blacklistBool(args?.profileUrl?.toLowerCase(), false)) {
        throw appError.buildExists(
          profileError.buildProfileInvalidBlacklistMsg(args?.profileUrl?.toLowerCase()),
          profileError.ErrorType.ProfileInvalid,
        )
      }

      const ofacBool = core.OFAC[helper.checkSum(wallet[0]?.address)]

      if (ofacBool) {
        throw appError.buildForbidden(`${wallet[0]?.address} is on OFAC`)
      }

      const hash =
        '0x' + abi.soliditySHA3(['address', 'string'], [wallet[0]?.address, args?.profileUrl]).toString('hex')

      const sigObj = web3.eth.accounts.sign(hash, privateKey)

      return {
        hash: sigObj.messageHash,
        signature: sigObj.signature,
      }
    })
}

const cancelBid = (_: any, args: gql.MutationCancelBidArgs, ctx: Context): Promise<boolean> => {
  const { user, repositories } = ctx
  logger.debug('cancelBid', { loggedInUserId: user.id, input: args })
  return repositories.bid.deleteById(args.id)
}

/**
 * Used for Genesis Key holders to set their Profile URI preferences.
 */
const setProfilePreferences = (
  _: any,
  args: gql.MutationSetProfilePreferencesArgs,
  ctx: Context,
): Promise<gql.Bid[]> => {
  const { user, wallet } = ctx
  logger.debug('setProfilePreferences', { loggedInUserId: user?.id, input: args?.input })

  // Verify we're accepting preferences right now
  if (serverConfigVar().activeGKPreferencePhase === -1) {
    throw appError.buildForbidden('Not accepting preferences at this time.')
  }

  // Verify they gave a valid preference array.
  // TODO (eddie): CHECK IF ANY URIs ARE DISALLOWED
  const schema = Joi.object().keys({
    urls: Joi.array().required().min(5).max(10).items(Joi.string()),
  })
  joi.validateSchema(schema, args.input)

  const phaseWeight = serverConfigVar().activeGKPreferencePhase === 1 ? 10 : 0
  const genesisKeyContract = typechain.GenesisKey__factory.connect(
    contracts.genesisKeyAddress(wallet.chainId),
    provider.provider(Number(wallet.chainId)),
  )
  return (
    genesisKeyContract
      .balanceOf(wallet.address)
      // Verify GK ownership
      .then(fp.rejectIf(balance => balance === 0)(appError.buildForbidden('Not a GenesisKey owner.')))
      // Find and Delete any previous preferences for this wallet.
      // TODO (eddie): skip this if we decide to collect 2 rounds of preferences
      .then(() =>
        ctx.repositories.bid.delete({
          nftType: gql.NFTType.GenesisKeyProfile,
          walletId: wallet.id,
        }),
      )
      // Fetch the Profiles by URLs and create Profiles that don't exist.
      .then(() => Promise.all(args.input.urls.map(url => core.createProfile(ctx, { url, chainId: wallet.chainId }))))
      // Save the new Bids
      .then((profiles: entity.Profile[]) =>
        Promise.all(
          args.input.urls.map((url, index) =>
            ctx.repositories.bid.save({
              nftType: gql.NFTType.GenesisKeyProfile,
              price: String(phaseWeight + (10 - index)),
              profileId: profiles[index].id,
              signature: {
                v: 0,
                r: '0x0000000000000000000000000000000000000000000000000000000000000000',
                s: '0x0000000000000000000000000000000000000000000000000000000000000000',
              },
              status: gql.BidStatus.Submitted,
              walletId: wallet.id,
              userId: user.id,
            }),
          ),
        ),
      )
  )
}

export default {
  Query: {
    // bids: getBids,
    myBids: combineResolvers(auth.isAuthenticated, getMyBids),
  },
  Mutation: {
    bid: bid,
    signHash: combineResolvers(auth.isAuthenticated, signHash),
    signHashProfile: combineResolvers(auth.isAuthenticated, signHashProfile),
    cancelBid: combineResolvers(auth.isAuthenticated, cancelBid),
    setProfilePreferences: combineResolvers(auth.isAuthenticated, setProfilePreferences),
  },
  Bid: {
    profile: core.resolveEntityById<gql.Bid, entity.Profile>('profileId', defs.EntityType.Bid, defs.EntityType.Profile),
    wallet: core.resolveEntityById<gql.Bid, entity.Wallet>('walletId', defs.EntityType.Bid, defs.EntityType.Wallet),
  },
}
