import { combineResolvers } from 'graphql-resolvers'
import Joi from 'joi'

import { Context, entity } from '@src/db'
import { gql, misc } from '@src/defs'
import { appError, profileError } from '@src/graphql/error'
import { _logger, fp, helper } from '@src/helper'

import { isAuthenticated } from './auth'
import * as coreService from './core.service'
import { validateSchema } from './joi'

const logger = _logger.Factory(_logger.Context.Profile, _logger.Context.GraphQL)

const toProfilesOutput = (profiles: entity.Profile[]): gql.ProfilesOutput => ({
  profiles,
  pageInfo: null,
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
  return coreService.thatEntitiesOfEdgesBy<entity.Profile>(ctx, {
    collectionId: user.id,
    thatEntityType: misc.EntityType.Profile,
    edgeType: misc.EdgeType.Follows,
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
  const filter: Partial<entity.NFT> = helper.removeEmpty({
    status: helper.safeIn(statuses),
    ownerUserId: user.id,
  })
  return coreService.entitiesBy(ctx.repositories.profile, filter, { createdAt: 'DESC' })
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

  validateSchema(buildProfileInputSchema('profileId'), args.input)

  return coreService.thisEntitiesOfEdgesBy<entity.Wallet>(ctx, {
    thatEntityId: args.input.profileId,
    thatEntityType: misc.EntityType.Profile,
    edgeType: misc.EdgeType.Follows,
  })
    .then((wallets) => ({
      wallets,
      pageInfo: null,
    }))
}

const followProfile = (
  _: any,
  args: gql.MutationFollowProfileArgs,
  ctx: Context,
): Promise<gql.Profile> => {
  const { user, wallet, repositories } = ctx
  logger.debug('followProfile', { loggedInUserId: user.id, input: args, wallet })

  const schema = Joi.object().keys({ url: Joi.string() })
  validateSchema(schema, args)

  const { url } = args
  return repositories.profile.findById(url)
    .then(fp.thruIfEmpty(() => coreService.createProfile(ctx, { url })))
    .then((profile) => {
      return repositories.edge.exists({
        collectionId: user.id,
        edgeType: misc.EdgeType.Follows,
        thatEntityId: profile.id,
        thatEntityType: misc.EntityType.Profile,
        deletedAt: null,
      })
        .then(fp.rejectIfTrue(appError.buildExists(
          profileError.buildProfileFollowingMsg(profile.id),
          profileError.ErrorType.ProfileAlreadyFollowing,
        )))
        .then(() => repositories.edge.save({
          collectionId: user.id,
          thisEntityId: wallet.id,
          thisEntityType: misc.EntityType.Wallet,
          edgeType: misc.EdgeType.Follows,
          thatEntityId: profile.id,
          thatEntityType: misc.EntityType.Profile,
        }))
        .then(() => profile)
    })
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

  validateSchema(buildProfileInputSchema(), args)

  return getProfile(args.id, repositories.profile.findById)
    .then(fp.tapWait((profile) => {
      return repositories.edge.delete({
        collectionId: user.id,
        edgeType: misc.EdgeType.Follows,
        thatEntityId: profile.id,
        thisEntityType: misc.EntityType.Profile,
        deletedAt: null,
      })
    }))
}

const getProfileByURL = (
  _: any,
  args: gql.QueryProfileArgs,
  ctx: Context,
): Promise<gql.Profile> => {
  const { user, repositories } = ctx
  logger.debug('getProfileByURL', { loggedInUserId: user?.id, input: args })
  const schema = Joi.object().keys({
    url: Joi.string().required(),
  })
  validateSchema(schema, args)
  return getProfile(args.url, repositories.profile.findByURL)
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
    bannerURL: Joi.string().uri(),
    description: Joi.string(),
    photoURL: Joi.string().uri(),
  })
  validateSchema(schema, args.input)

  const notOwner = (p: entity.Profile): boolean => p.ownerUserId !== user.id
  const { id } = args.input

  return getProfile(id, repositories.profile.findById)
    .then(fp.rejectIf(notOwner)(appError.buildForbidden(
      profileError.buildProfileNotOwnedMsg(id),
      profileError.ErrorType.ProfileNotOwned,
    )))
    .then((p) => {
      p.bannerURL = args.input.bannedURL || p.bannerURL
      p.description = args.input.description || p.description
      p.photoURL = args.input.photoURL || p.photoURL
      return repositories.profile.save(p)
    })
}

const getFollowersCount = (
  parent: gql.Profile,
  _: unknown,
  ctx: Context,
): Promise<number> => {
  return coreService.countEdges(ctx, {
    thatEntityId: parent.id,
    edgeType: misc.EdgeType.Follows,
  })
}

export default {
  Query: {
    profile: getProfileByURL,
    myProfiles: combineResolvers(isAuthenticated, getMyProfiles),
    profileFollowers: getProfileFollowers,
    profilesFollowedByMe: combineResolvers(isAuthenticated, getProfilesFollowedByMe),
  },
  Mutation: {
    followProfile: combineResolvers(isAuthenticated, followProfile),
    unfollowProfile: combineResolvers(isAuthenticated, unfollowProfile),
    updateProfile: combineResolvers(isAuthenticated, updateProfile),
  },
  Profile: {
    followersCount: getFollowersCount,
    owner: coreService.resolveEntityById(
      'ownerId',
      misc.EntityType.Profile,
      misc.EntityType.Wallet,
    ),
    isOwnedByMe: coreService.resolveEntityOwnership(
      'ownerUserId',
      'user',
      misc.EntityType.Profile,
    ),
    isFollowedByMe: coreService.resolveEdgeOwnership(
      'user',
      misc.EdgeType.Follows,
    ),
    winningBid: getWinningBid,
  },
}
