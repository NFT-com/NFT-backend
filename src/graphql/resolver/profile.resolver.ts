import { combineResolvers } from 'graphql-resolvers'
import Joi from 'joi'

import { Context, entity } from '@src/db'
import { EdgeType, EntityType, gqlTypes } from '@src/defs'
import { appError, profileError } from '@src/graphql/error'
import { fp } from '@src/helper'
import { LoggerContext, LoggerFactory } from '@src/helper/logger'

import { isAuthenticated } from './auth'
import { validateSchema } from './joi'
import * as service from './service'

const logger = LoggerFactory(LoggerContext.GraphQL, LoggerContext.Profile)

const toProfilesOutput = (profiles: entity.Profile[]): gqlTypes.ProfilesOutput => ({
  profiles,
  pageInfo: null,
})

// TODO implement pagination
const getProfilesFollowedByMe = (
  _: any,
  args: gqlTypes.QueryProfilesFollowedByMeArgs,
  ctx: Context,
): Promise<gqlTypes.ProfilesOutput> => {
  const { user } = ctx
  logger.debug('getProfilesFollowedByMe', { loggedInUserId: user.id, input: args.input })
  return service.thatEntitiesOfEdgesBy<entity.Profile>(ctx, {
      collectionId: user.id,
      thatEntityType: EntityType.Profile,
      edgeType: EdgeType.Follows,
    })
    .then(toProfilesOutput)
}

// TODO implement pagination
const getMyProfiles = (
  _: any,
  args: gqlTypes.QueryMyProfilesArgs,
  ctx: Context,
): Promise<gqlTypes.ProfilesOutput> => {
  const { user } = ctx
  logger.debug('getMyProfiles', { loggedInUserId: user.id, input: args.input })
  return service.entitiesBy(ctx.repositories.profile, { ownerUserId: user.id })
    .then(toProfilesOutput)
}

const buildProfileInputSchema = (): Joi.ObjectSchema =>
  Joi.object().keys({
    profileId: Joi.string().required(),
  })

// TODO implement pagination
const getProfileFollowers = (
  _: any,
  args: gqlTypes.QueryProfileFollowersArgs,
  ctx: Context,
): Promise<gqlTypes.FollowersOutput> => {
  const { user } = ctx
  logger.debug('getProfileFollowers', { loggedInUserId: user.id, input: args.input })

  validateSchema(buildProfileInputSchema(), args)

  return service.thisEntitiesOfEdgesBy<entity.Wallet>(ctx, {
      thatEntityId: args.input.profileId,
      thatEntityType: EntityType.Profile,
      edgeType: EdgeType.Follows,
    })
    .then((wallets) => ({
      wallets,
      pageInfo: null,
    }))
}

const getProfile = (ctx: Context, profileId: string): Promise<entity.Profile | never> => {
  return ctx.repositories.profile.findById(profileId)
    .then(fp.tapRejectIfEmpty(appError.buildNotFound(
      profileError.buildProfileNotFoundMsg(profileId),
      profileError.ErrorType.ProfileNotFound,
    )))
}

const followProfile = (
  _: any,
  args: gqlTypes.MutationFollowProfileArgs,
  ctx: Context,
): Promise<gqlTypes.Profile> => {
  const { user, wallet, repositories } = ctx
  logger.debug('followProfile', { loggedInUserId: user.id, input: args, wallet })

  validateSchema(buildProfileInputSchema(), args)

  return getProfile(ctx, args.id)
    .then((profile) => {
      return repositories.edge.exists({
        collectionId: user.id,
        edgeType: EdgeType.Follows,
        thatEntityId: profile.id,
        thatEntityType: EntityType.Profile,
        deletedAt: null,
      })
        .then(fp.tapRejectIfTrue(appError.buildExists(
            profileError.buildProfileFollowingMsg(profile.id),
            profileError.ErrorType.ProfileAlreadyFollowing,
        )))
        .then(() => repositories.edge.save({
          collectionId: user.id,
          thisEntityId: wallet.id,
          thisEntityType: EntityType.Wallet,
          edgeType: EdgeType.Follows,
          thatEntityId: profile.id,
          thatEntityType: EntityType.Profile,
        }))
        .then(() => profile)
    })
}

const unfollowProfile = (
  _: any,
  args: gqlTypes.MutationUnfollowProfileArgs,
  ctx: Context,
): Promise<gqlTypes.Profile> => {
  const { user, wallet, repositories } = ctx
  logger.debug('followProfile', { loggedInUserId: user.id, input: args, wallet })

  validateSchema(buildProfileInputSchema(), args)

  return getProfile(ctx, args.id)
    .then(fp.tapWait((profile) => {
      return repositories.edge.delete({
        collectionId: user.id,
        edgeType: EdgeType.Follows,
        thatEntityId: profile.id,
        thisEntityType: EntityType.Profile,
        deletedAt: null,
      })
    }))
}

export default {
  Query: {
    myProfiles: combineResolvers(isAuthenticated, getMyProfiles),
    profileFollowers: combineResolvers(isAuthenticated, getProfileFollowers),
    profilesFollowedByMe: combineResolvers(isAuthenticated, getProfilesFollowedByMe),
  },
  Mutation: {
    followProfile,
    unfollowProfile,
  },
  Profile: {
    creator: service.resolveEntityById('creatorId', EntityType.Profile, EntityType.Wallet),
    owner: service.resolveEntityById('ownerId', EntityType.Profile, EntityType.Wallet),
    isOwnedByMe: service.resolveEntityOwnership('ownerUserId', 'user', EntityType.Profile),
    isFollowedByMe: service.resolveEdgeOwnership('user', EdgeType.Follows),
  },
}
