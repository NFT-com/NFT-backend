import { combineResolvers } from 'graphql-resolvers'
import Joi from 'joi'

import { Context, entity } from '@src/db'
import { EdgeType, EntityType, gqlTypes } from '@src/defs'
import { appError } from '@src/graphql/error'
import { LoggerContext, LoggerFactory } from '@src/helper/logger'

import { isAuthenticated } from './auth'
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

// TODO implement pagination
const getProfileFollowers = (
  _: any,
  args: gqlTypes.QueryProfileFollowersArgs,
  ctx: Context,
): Promise<gqlTypes.FollowersOutput> => {
  const { user } = ctx
  logger.debug('getProfileFollowers', { loggedInUserId: user.id, input: args.input })

  const schema = Joi.object().keys({
    profileId: Joi.string().required(),
  })
  const { error } = schema.validate(args.input, { abortEarly: false })
  if (error) {
    throw appError.buildInvalidSchemaError(error)
  }

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

export default {
  Query: {
    myProfiles: combineResolvers(isAuthenticated, getMyProfiles),
    profileFollowers: combineResolvers(isAuthenticated, getProfileFollowers),
    profilesFollowedByMe: combineResolvers(isAuthenticated, getProfilesFollowedByMe),
  },
  Profile: {
    creator: service.resolveEntityById('creatorId', EntityType.Profile, EntityType.Wallet),
    owner: service.resolveEntityById('ownerId', EntityType.Profile, EntityType.Wallet),
    isOwnedByMe: service.resolveEntityOwnership('ownerUserId', 'user', EntityType.Profile),
    isFollowedByMe: service.resolveEdgeOwnership('user', EdgeType.Follows),
  },
}
