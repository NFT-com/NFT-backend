import { combineResolvers } from 'graphql-resolvers'
import Joi from 'joi'

import { Context, entity } from '@src/db'
import { gql, misc } from '@src/defs'
import { appError, profileError } from '@src/graphql/error'
import { _logger, fp } from '@src/helper'

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
  logger.debug('getProfilesFollowedByMe', { loggedInUserId: user.id, input: args.input })
  return coreService.thatEntitiesOfEdgesBy<entity.Profile>(ctx, {
      collectionId: user.id,
      thatEntityType: misc.EntityType.Profile,
      edgeType: misc.EdgeType.Follows,
    })
    .then(toProfilesOutput)
}

// TODO implement pagination
const getMyProfiles = (
  _: any,
  args: gql.QueryMyProfilesArgs,
  ctx: Context,
): Promise<gql.ProfilesOutput> => {
  const { user } = ctx
  logger.debug('getMyProfiles', { loggedInUserId: user.id, input: args.input })
  return coreService.entitiesBy(ctx.repositories.profile, { ownerUserId: user.id })
    .then(toProfilesOutput)
}

const buildProfileInputSchema = (): Joi.ObjectSchema =>
  Joi.object().keys({
    profileId: Joi.string().required(),
  })

// TODO implement pagination
const getProfileFollowers = (
  _: any,
  args: gql.QueryProfileFollowersArgs,
  ctx: Context,
): Promise<gql.FollowersOutput> => {
  const { user } = ctx
  logger.debug('getProfileFollowers', { loggedInUserId: user.id, input: args.input })

  validateSchema(buildProfileInputSchema(), args)

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

const getProfile = (
  lookupVal: string,
  fbFn: (k: string) => Promise<entity.Profile>,
): Promise<entity.Profile | never> => {
  return fbFn(lookupVal)
    .then(fp.tapRejectIfEmpty(appError.buildNotFound(
      profileError.buildProfileNotFoundMsg(lookupVal),
      profileError.ErrorType.ProfileNotFound,
    )))
}

const followProfile = (
  _: any,
  args: gql.MutationFollowProfileArgs,
  ctx: Context,
): Promise<gql.Profile> => {
  const { user, wallet, repositories } = ctx
  logger.debug('followProfile', { loggedInUserId: user.id, input: args, wallet })

  validateSchema(buildProfileInputSchema(), args)

  return getProfile(args.id, repositories.profile.findById)
    .then((profile) => {
      return repositories.edge.exists({
        collectionId: user.id,
        edgeType: misc.EdgeType.Follows,
        thatEntityId: profile.id,
        thatEntityType: misc.EntityType.Profile,
        deletedAt: null,
      })
        .then(fp.tapRejectIfTrue(appError.buildExists(
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
  logger.debug('getProfileByURL', { loggedInUserId: user.id, input: args })
  const schema = Joi.object().keys({
    url: Joi.string().required(),
  })
  validateSchema(schema, args)
  return getProfile(args.url, repositories.profile.findByURL)
}

export default {
  Query: {
    profile: getProfileByURL,
    myProfiles: combineResolvers(isAuthenticated, getMyProfiles),
    profileFollowers: getProfileFollowers,
    profilesFollowedByMe: combineResolvers(isAuthenticated, getProfilesFollowedByMe),
  },
  Mutation: {
    followProfile,
    unfollowProfile,
  },
  Profile: {
    creator: coreService.resolveEntityById(
      'creatorId',
      misc.EntityType.Profile,
      misc.EntityType.Wallet,
    ),
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
  },
}
