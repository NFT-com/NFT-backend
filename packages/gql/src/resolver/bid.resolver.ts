import { differenceInSeconds, isEqual } from 'date-fns'
import { combineResolvers } from 'graphql-resolvers'
import Joi from 'joi'

import { serverConfigVar } from '@nftcom/gql/config'
import { Context, gql } from '@nftcom/gql/defs'
import { appError } from '@nftcom/gql/error'
import { auth, joi, pagination } from '@nftcom/gql/helper'
import { core, sendgrid } from '@nftcom/gql/service'
import { _logger, defs, entity, fp, helper } from '@nftcom/shared'
import { contracts, provider, typechain } from '@nftcom/shared/helper'

const logger = _logger.Factory(_logger.Context.Bid, _logger.Context.GraphQL)

const sendBidNotifications = (
  newBid: entity.Bid,
  prevTopBidOwner: entity.User,
  newBidOwner: entity.User,
  profileURL: string,
): Promise<[boolean, boolean]> => Promise.all([
  sendgrid.sendBidConfirmEmail(newBid, newBidOwner, profileURL),
  sendgrid.sendOutbidEmail(prevTopBidOwner, profileURL),
])

const bid = (
  _: any,
  args: gql.MutationBidArgs,
  ctx: Context,
): Promise<gql.Bid> => {
  const { user, repositories } = ctx
  logger.debug('bid', { loggedInUserId: user.id, input: args.input })

  const schema = Joi.object().keys({
    nftType: Joi.string().required().valid(...Object.values(gql.NFTType)),
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

  return core.getWallet(ctx, input.wallet)
    .then(({ id: walletId }) => {
      if (input.nftType !== gql.NFTType.Profile) {
        return { walletId, profileId: null }
      }

      // create profile if it doesn't exist
      return repositories.profile.findByURL(input.profileURL)
        .then(fp.thruIfEmpty(() => core.createProfile(ctx, { url: input.profileURL })))
        .then(({ id }) => ({ walletId, profileId: id }))
    })
    .then(({ profileId, walletId }) => {
      if (input.nftType === gql.NFTType.GenesisKey) {
        return repositories.bid.findOne({ where: {
          nftType: gql.NFTType.GenesisKey,
          walletId,
        } }).then((previousGKBid) => ({
          walletId,
          profileId,
          stakeWeight: null,
          existingBid: previousGKBid,
          prevTopBidOwner: null,
        }))
      } else if (input.nftType !== gql.NFTType.Profile) {
        // TODO: find bid and prevTopBid for non-profile NFTs too.
        return { walletId, profileId, stakeWeight: null, existingBid: null, prevTopBidOwner: null }
      }

      // calculate stake weight seconds for Profile bids
      return repositories.bid.findRecentBidByProfileUser(profileId, user.id)
        .then((existingBid) => {
          const now = helper.toUTCDate()
          const existingUpdateTime = existingBid?.updatedAt || now
          const existingStake = existingBid?.price || 0
          const existingStakeWeight = existingBid?.stakeWeightedSeconds || 0
          const curSeconds = isEqual(now, existingUpdateTime)
            ? 0
            : differenceInSeconds(now, existingUpdateTime)
          const bigNumStake = helper.bigNumber(existingStake).div(helper.tokenDecimals)
          const stakeWeight = existingStakeWeight + curSeconds * Number(bigNumStake)
          return {
            walletId,
            profileId,
            stakeWeight,
            existingBid,
            prevTopBidOwner: repositories.bid.findTopBidByProfile(profileId)
              .then(fp.thruIfNotEmpty(
                (prevTopBid) => repositories.user.findById(prevTopBid.userId))),
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
    .then(fp.tapIf(([newBid]) => newBid.nftType === defs.NFTType.Profile)(
      ([newBid, prevTopBidOwner]) =>
        sendBidNotifications(newBid, prevTopBidOwner, user, input.profileURL)),
    )
    .then(([newBid]) => newBid)
}

const getBids = (
  _: any,
  args: gql.QueryBidsArgs,
  ctx: Context,
): Promise<gql.BidsOutput> => {
  const { user, repositories } = ctx
  logger.debug('getBids', { loggedInUserId: user?.id, input: args?.input })
  const pageInput = args?.input?.pageInput

  // TODO (eddie): add support for querying all public 
  // bids for a user, given one of their wallet's details.

  return Promise.resolve(args?.input?.wallet)
    .then(fp.thruIfNotEmpty((walletInput) => {
      return repositories.wallet.findByNetworkChainAddress(
        walletInput.network,
        walletInput.chainId,
        walletInput.address,
      )
    }))
    .then((wallet: entity.Wallet) => {
      const inputFilters = {
        profileId: args?.input?.profileId,
        walletId: wallet?.id,
        nftType: args?.input?.nftType,
      }
      const filter = helper.inputT2SafeK(inputFilters)
      return core.paginatedEntitiesBy(
        ctx.repositories.bid,
        pageInput,
        filter,
      )
    })
    .then(pagination.toPageable(pageInput))
}

const getMyBids = (
  _: any,
  args: gql.QueryMyBidsArgs,
  ctx: Context,
): Promise<gql.BidsOutput> => {
  const { user } = ctx
  logger.debug('getMyBids', { loggedInUserId: user.id, input: args?.input })
  const pageInput = args?.input?.pageInput
  const filter = helper.inputT2SafeK<entity.Bid>({ ...args?.input, userId: user.id })
  return core.paginatedEntitiesBy(
    ctx.repositories.bid,
    pageInput,
    filter,
  )
    .then(pagination.toPageable(pageInput))
}

const cancelBid = (
  _: any,
  args: gql.MutationCancelBidArgs,
  ctx: Context,
): Promise<boolean> => {
  const { user, repositories } = ctx
  logger.debug('cancelBid', { loggedInUserId: user.id, input: args })
  return repositories.bid.deleteById(args.id)
}

const getTopBids = (
  _: any,
  args: gql.QueryTopBidsArgs,
  ctx: Context,
): Promise<gql.BidsOutput> => {
  const { user } = ctx
  logger.debug('getTopBids', { loggedInUserId: user?.id, input: args?.input })
  const pageInput = args?.input?.pageInput
  const inputFilters = {
    profileId: args?.input?.profileId,
  }
  const filter = helper.inputT2SafeK(inputFilters)
  return core.paginatedEntitiesBy(
    ctx.repositories.bid,
    pageInput,
    filter,
    'price',
  )
    .then(pagination.toPageable(pageInput, 'price'))
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
  const schema = Joi.object().keys({
    urls: Joi.array().required().min(5).max(10).items(Joi.string()),
  })
  joi.validateSchema(schema, args.input)

  const phaseWeight = serverConfigVar().activeGKPreferencePhase === 1 ? 0 : 10
  const genesisKeyContract = typechain.GenesisKey__factory.connect(
    contracts.genesisKeyAddress(wallet.chainId),
    provider.provider(Number(wallet.chainId)),
  )
  return genesisKeyContract
    .balanceOf(wallet.address)
    // Verify GK ownership
    .then(fp.rejectIf((balance) => balance === 0)(appError.buildForbidden('Not a GenesisKey owner.')))
    // Find and Delete any previous preferences for this wallet.
    .then(() => ctx.repositories.bid.delete({
      nftType: gql.NFTType.GenesisKeyProfile,
      walletId: wallet.id,
    }))
    // Fetch the Profiles by URLs and create Profiles that don't exist.
    .then(() => Promise.all(
      args.input.urls.map((url) =>
        ctx.repositories.profile.findByURL(url)
          .then(fp.thruIfEmpty(() => core.createProfile(ctx, { url }))),
      ),
    ))
    // Save the new Bids
    .then((profiles: entity.Profile[]) =>
      Promise.all(args.input.urls.map((url, index) => ctx.repositories.bid.save({
        nftType: gql.NFTType.GenesisKeyProfile,
        price: String(phaseWeight + index),
        profileId: profiles[index].id,
        signature: {
          v: 0,
          r: '',
          s: '',
        },
        status: gql.BidStatus.Submitted,
        walletId: wallet.id,
        userId: user.id,
      }))))
}

export default {
  Query: {
    bids: getBids,
    myBids: combineResolvers(auth.isAuthenticated, getMyBids),
    topBids: getTopBids,
  },
  Mutation: {
    bid: combineResolvers(auth.isAuthenticated, bid),
    cancelBid: combineResolvers(auth.isAuthenticated, cancelBid),
    setProfilePreferences: combineResolvers(auth.isAuthenticated, setProfilePreferences),
  },
  Bid: {
    profile: core.resolveEntityById<gql.Bid, entity.Profile>(
      'profileId',
      defs.EntityType.Bid,
      defs.EntityType.Profile,
    ),
    wallet: core.resolveEntityById<gql.Bid, entity.Wallet>(
      'walletId',
      defs.EntityType.Bid,
      defs.EntityType.Wallet,
    ),
  },
}
