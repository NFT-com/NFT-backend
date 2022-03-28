import { utils } from 'ethers'
import { combineResolvers } from 'graphql-resolvers'
import Joi from 'joi'
import Typesense from 'typesense'

import { Context, gql } from '@nftcom/gql/defs'
import { appError, mintError, profileError } from '@nftcom/gql/error'
import { auth, joi } from '@nftcom/gql/helper'
import { core } from '@nftcom/gql/service'
import { _logger, contracts, defs, entity, fp, helper, provider } from '@nftcom/shared'

const logger = _logger.Factory(_logger.Context.Profile, _logger.Context.GraphQL)
const TYPESENSE_HOST = process.env.TYPESENSE_HOST
const TYPESENSE_API_KEY = process.env.TYPESENSE_API_KEY
const client = new Typesense.Client({
  'nodes': [{
    'host': TYPESENSE_HOST, // For Typesense Cloud use xxx.a1.typesense.net
    'port': 8108,      // For Typesense Cloud use 443
    'protocol': 'http',   // For Typesense Cloud use https
  }],
  'apiKey': TYPESENSE_API_KEY,
  'connectionTimeoutSeconds': 2,
})

const toProfilesOutput = (profiles: entity.Profile[]): gql.ProfilesOutput => ({
  items: profiles,
  pageInfo: null,
  totalItems: profiles.length,
})

// TODO implement pagination
const getProfilesFollowedByMe = (
  _: any,
  args: gql.QueryProfilesFollowedByMeArgs,
  ctx: Context,
): Promise<gql.ProfilesOutput> => {
  const { user } = ctx
  logger.debug('getProfilesFollowedByMe', { loggedInUserId: user.id, input: args?.input })
  const { statuses } = helper.safeObject(args?.input)
  return core.thatEntitiesOfEdgesBy<entity.Profile>(ctx, {
    collectionId: user.id,
    thatEntityType: defs.EntityType.Profile,
    edgeType: defs.EdgeType.Follows,
  })
    .then(fp.filterIfNotEmpty(statuses)((p) => statuses.includes(p.status)))
    .then(toProfilesOutput)
}

// TODO implement pagination
const getMyProfiles = (
  _: any,
  args: gql.QueryMyProfilesArgs,
  ctx: Context,
): Promise<gql.ProfilesOutput> => {
  const { user } = ctx
  logger.debug('getMyProfiles', { loggedInUserId: user.id, input: args?.input })
  const { statuses } = helper.safeObject(args?.input)
  const filter: Partial<entity.Profile> = helper.removeEmpty({
    status: helper.safeIn(statuses),
    ownerUserId: user.id,
  })
  return core.entitiesBy(ctx.repositories.profile, filter)
    .then(toProfilesOutput)
}

const buildProfileInputSchema = (profileIdKey = 'id'): Joi.ObjectSchema =>
  Joi.object().keys({
    [profileIdKey]: Joi.string().required(),
  })

// TODO implement pagination
const getProfileFollowers = (
  _: any,
  args: gql.QueryProfileFollowersArgs,
  ctx: Context,
): Promise<gql.FollowersOutput> => {
  const { user } = ctx
  logger.debug('getProfileFollowers', { loggedInUserId: user?.id, input: args.input })

  joi.validateSchema(buildProfileInputSchema('profileId'), args.input)

  return core.thisEntitiesOfEdgesBy<entity.Wallet>(ctx, {
    thatEntityId: args.input.profileId,
    thatEntityType: defs.EntityType.Profile,
    edgeType: defs.EdgeType.Follows,
  })
    .then((wallets) => ({
      items: wallets,
      pageInfo: null,
      totalItems: wallets.length,
    }))
}

const createFollowEdge = (ctx: Context) => {
  return (profile: entity.Profile): Promise<entity.Edge | boolean> => {
    const { user, wallet, repositories } = ctx
    return repositories.edge.exists({
      collectionId: user.id,
      edgeType: defs.EdgeType.Follows,
      thatEntityId: profile.id,
      thatEntityType: defs.EntityType.Profile,
      deletedAt: null,
    })
      .then(fp.thruIfFalse(() => core.createEdge(ctx,  {
        collectionId: user.id,
        thisEntityId: wallet.id,
        thisEntityType: defs.EntityType.Wallet,
        edgeType: defs.EdgeType.Follows,
        thatEntityId: profile.id,
        thatEntityType: defs.EntityType.Profile,
      })))
  }
}

const followProfile = (
  _: any,
  args: gql.MutationFollowProfileArgs,
  ctx: Context,
): Promise<gql.Profile> => {
  const { user, wallet } = ctx
  logger.debug('followProfile', { loggedInUserId: user.id, input: args, wallet })

  const schema = Joi.object().keys({ url: Joi.string() })
  joi.validateSchema(schema, args)

  const { url } = args
  return core.createProfile(ctx, { url })
    .then(fp.tapWait(createFollowEdge(ctx)))
}

const getProfile = (
  lookupVal: string,
  fbFn: (k: string) => Promise<entity.Profile>,
): Promise<entity.Profile | never> => {
  return fbFn(lookupVal)
    .then(fp.rejectIfEmpty(appError.buildNotFound(
      profileError.buildProfileNotFoundMsg(lookupVal),
      profileError.ErrorType.ProfileNotFound,
    )))
}

const unfollowProfile = (
  _: any,
  args: gql.MutationUnfollowProfileArgs,
  ctx: Context,
): Promise<gql.Profile> => {
  const { user, wallet, repositories } = ctx
  logger.debug('followProfile', { loggedInUserId: user.id, input: args, wallet })

  joi.validateSchema(buildProfileInputSchema(), args)

  return getProfile(args.id, repositories.profile.findById)
    .then(fp.tapWait((profile) => {
      return repositories.edge.delete({
        collectionId: user.id,
        edgeType: defs.EdgeType.Follows,
        thatEntityId: profile.id,
        thatEntityType: defs.EntityType.Profile,
        deletedAt: null,
      })
    }))
}

const getProfileByURLPassive = (
  _: any,
  args: gql.QueryProfileArgs,
  ctx: Context,
): Promise<gql.Profile> => {
  const { user } = ctx
  logger.debug('getProfileByURLPassive', { loggedInUserId: user?.id, input: args })
  const schema = Joi.object().keys({
    url: Joi.string().required(),
  })
  joi.validateSchema(schema, args)

  return ctx.repositories.profile.findByURL(args.url)
    .then(fp.rejectIfEmpty(appError.buildExists(
      profileError.buildProfileNotFoundMsg(args.url),
      profileError.ErrorType.ProfileNotFound,
    )))
}

const getProfileByURL = (
  _: any,
  args: gql.QueryProfileArgs,
  ctx: Context,
): Promise<gql.Profile> => {
  const { user } = ctx
  logger.debug('getProfileByURL', { loggedInUserId: user?.id, input: args })
  const schema = Joi.object().keys({
    url: Joi.string().required(),
  })
  joi.validateSchema(schema, args)

  return core.createProfile(ctx, { url: args.url })
}

const getWinningBid = (
  parent: gql.Profile,
  _: unknown,
  ctx: Context,
): Promise<gql.Bid> => {
  const { user, repositories } = ctx
  logger.debug('getWinningBid', { loggedInUserId: user?.id })
  return repositories.bid.findTopBidByProfile(parent.id)
}

const updateProfile = (
  _: any,
  args: gql.MutationUpdateProfileArgs,
  ctx: Context,
): Promise<gql.Profile> => {
  const { user, repositories } = ctx
  logger.debug('updateProfile', { loggedInUserId: user.id, input: args.input })

  const schema = Joi.object().keys({
    id: Joi.string().required(),
    bannerURL: Joi.string().uri().allow(null),
    description: Joi.string().allow(null),
    photoURL: Joi.string().uri().allow(null),
    showGallery: Joi.boolean(),
  })
  joi.validateSchema(schema, args.input)

  const notOwner = (p: entity.Profile): boolean => p.ownerUserId !== user.id
  const { id } = args.input

  return getProfile(id, repositories.profile.findById)
    .then(fp.rejectIf(notOwner)(appError.buildForbidden(
      profileError.buildProfileNotOwnedMsg(id),
      profileError.ErrorType.ProfileNotOwned,
    )))
    .then((p) => {
      p.bannerURL = args.input.bannerURL || p.bannerURL
      p.description = args.input.description || p.description
      p.photoURL = args.input.photoURL || p.photoURL
      p.showGallery = args.input.showGallery || p.showGallery
      return repositories.profile.save(p)
    })
}

const getFollowersCount = (
  parent: gql.Profile,
  _: unknown,
  ctx: Context,
): Promise<number> => {
  return core.countEdges(ctx, {
    thatEntityId: parent.id,
    edgeType: defs.EdgeType.Follows,
  })
}

const getBlockedProfileURIs = (): Promise<string[]> => {
  logger.debug('getBlockedProfiles')
  const blocklist = core.blacklistProfiles
  return Promise.resolve(Object.keys(blocklist))
}

// TODO: make sure this is running on cron job -> that pull events from:
// TODO: emit MintedProfile(_owner, _profileURI, _nftTokens, claimableBlock[hash]);
const profileClaimed = (
  _: any,
  args: gql.MutationProfileClaimedArgs,
  ctx: Context,
): Promise<gql.Profile> => {
  const { repositories } = ctx
  const { profileId, walletId, txHash } = args.input
  logger.debug('profileClaimed', { profileId, walletId, txHash })

  const profileAuction = new utils.Interface(contracts.profileAuctionABI())

  return repositories.wallet.findById(walletId)
    .then((wallet: entity.Wallet) => Promise.all([
      Promise.resolve(wallet),
      repositories.profile.findById(profileId),
      provider.provider(Number(wallet.chainId)).getTransactionReceipt(txHash),
    ]))
    .then(([wallet, profile, txReceipt]) => {
      if (
        txReceipt.from !== wallet.address ||
        txReceipt.to !== contracts.profileAuctionAddress(wallet.chainId) ||
        !txReceipt.logs.some((log) => {
          try {
            const parsed = profileAuction.parseLog(log)
            return parsed?.topic === contracts.MintedProfileTopic && (parsed?.args['_val'] ?? '') === profile.url
          } catch (error) {
            // event doesn't match our definition of ProfileAuction Contract
            return false
          }
        })
      ) {
        return appError.buildInvalid(
          mintError.buildInvalidProfileClaimTransaction(),
          mintError.ErrorType.ProfileClaimTransaction,
        )
      }
      return profile
    })
    .then(fp.rejectIf((profile: entity.Profile) => profile.ownerWalletId !== walletId)(
      appError.buildInvalid(
        profileError.buildProfileNotOwnedMsg(profileId),
        profileError.ErrorType.ProfileNotOwned,
      ),
    ))
    .then(async (profile: entity.Profile) => {
      profile.status = defs.ProfileStatus.Owned

      const saveProfile = repositories.profile.save(profile)

      if (process.env.NODE_ENV !== 'local') {
        const indexProfile = []
        indexProfile.push({
          id: profile.id,
          profile: profile.url,
        })
  
        try {
          await client.collections('profiles').documents().import(indexProfile,{ action : 'create' })
          logger.debug('profile added to typesense index')
        }
        catch (err) {
          logger.info('error: could not save profile in typesense: ' + err)
        }
      }
      
      return saveProfile
    })
}

export default {
  Query: {
    profile: getProfileByURL,
    profilePassive: getProfileByURLPassive,
    myProfiles: combineResolvers(auth.isAuthenticated, getMyProfiles),
    profileFollowers: getProfileFollowers,
    profilesFollowedByMe: combineResolvers(auth.isAuthenticated, getProfilesFollowedByMe),
    blockedProfileURIs: getBlockedProfileURIs,
  },
  Mutation: {
    followProfile: combineResolvers(auth.isAuthenticated, followProfile),
    unfollowProfile: combineResolvers(auth.isAuthenticated, unfollowProfile),
    updateProfile: combineResolvers(auth.isAuthenticated, updateProfile),
    profileClaimed: combineResolvers(auth.isAuthenticated, profileClaimed),
  },
  Profile: {
    followersCount: getFollowersCount,
    owner: core.resolveEntityById<gql.Profile, entity.Wallet>(
      'ownerWalletId',
      defs.EntityType.Profile,
      defs.EntityType.Wallet,
    ),
    isOwnedByMe: core.resolveEntityOwnership<gql.Profile>(
      'ownerUserId',
      'user',
      defs.EntityType.Profile,
    ),
    isFollowedByMe: core.resolveEdgeOwnership<gql.Profile>(
      'wallet',
      defs.EdgeType.Follows,
    ),
    winningBid: getWinningBid,
  },
}
