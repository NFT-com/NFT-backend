import { combineResolvers } from 'graphql-resolvers'
import Joi from 'joi'

import { appError, curationError, nftError, profileError } from '@nftcom/error-types'
import { auth, Context, joi, pagination } from '@nftcom/misc'
import { core } from '@nftcom/service'
import { _logger, defs, entity, fp, helper } from '@nftcom/shared'

import { gql } from '../defs'

const logger = _logger.Factory(_logger.Context.Curation, _logger.Context.GraphQL)

const getMyCurations = (_: any, args: gql.QueryMyCurationsArgs, ctx: Context): Promise<gql.CurationsOutput> => {
  const { user, repositories } = ctx
  logger.debug('getMyCurations', { loggedInUserId: user?.id, input: args?.input })
  const pageInput = args?.input?.pageInput
  const filters = [helper.inputT2SafeK<entity.Curation>(args?.input, { userId: user.id })]
  return core
    .paginatedEntitiesBy<entity.Curation>(
      repositories.curation,
      pageInput,
      filters,
      [], // relations
    )
    .then(entities => pagination.toPageable(pageInput)(entities))
}

const validateNFTOwnership = (ctx: Context, items: defs.CurationItem[], user: entity.User): Promise<boolean> => {
  return Promise.all(items.map((item: defs.CurationItem) => ctx.repositories.nft.findById(item.id))).then(
    (nfts: entity.NFT[]) => !nfts.some(nft => nft?.userId !== user.id),
  )
}

const createCuration = (_: any, args: gql.MutationCreateCurationArgs, ctx: Context): Promise<gql.Curation> => {
  const { user, repositories } = ctx
  logger.debug('createCuration', { loggedInUserId: user?.id, input: args?.input })

  const schema = Joi.object().keys({
    items: Joi.array()
      .min(1)
      .max(100)
      .items(
        Joi.object().keys({
          id: Joi.string().required(),
          size: Joi.string().optional(),
        }),
      ),
  })
  joi.validateSchema(schema, args?.input)

  return validateNFTOwnership(ctx, args?.input?.items, user)
    .then(fp.rejectIfFalse(appError.buildForbidden(nftError.buildNFTNotOwnedMsg(), nftError.ErrorType.NFTNotOwned)))
    .then(() =>
      repositories.curation.save({
        userId: user?.id,
        items: args?.input?.items,
      }),
    )
}

const updateCuration = (_: any, args: gql.MutationUpdateCurationArgs, ctx: Context): Promise<gql.Curation> => {
  const { user, repositories } = ctx
  logger.debug('updateCuration', { loggedInUserId: user?.id, input: args?.input })

  const schema = Joi.object().keys({
    id: Joi.string().required(),
    items: Joi.array()
      .min(1)
      .max(100)
      .items(
        Joi.object().keys({
          id: Joi.string().required(),
          size: Joi.string().optional(),
        }),
      ),
  })
  joi.validateSchema(schema, args?.input)

  return validateNFTOwnership(ctx, args?.input?.items, user)
    .then(fp.rejectIfFalse(appError.buildForbidden(nftError.buildNFTNotOwnedMsg(), nftError.ErrorType.NFTNotOwned)))
    .then(() => repositories.curation.findById(args?.input?.id))
    .then(
      fp.rejectIfEmpty(
        appError.buildNotFound(
          curationError.buildCurationNotFoundMsg(args?.input?.id),
          curationError.ErrorType.CurationNotFound,
        ),
      ),
    )
    .then(
      fp.rejectIf((curation: entity.Curation) => curation.userId !== user?.id)(
        appError.buildForbidden(curationError.buildCurationNotOwnedMsg(), curationError.ErrorType.CurationNotOwned),
      ),
    )
    .then((curation: entity.Curation) =>
      repositories.curation.save({
        ...curation,
        items: args?.input?.items,
      }),
    )
}

const setCuration = (_: any, args: gql.MutationSetCurationArgs, ctx: Context): Promise<gql.Profile> => {
  const { user, repositories } = ctx
  logger.debug('setCuration', { loggedInUserId: user?.id, input: args?.input })

  const schema = Joi.object().keys({ curationId: Joi.string(), profileId: Joi.string() })
  joi.validateSchema(schema, args?.input)

  return repositories.curation
    .findById(args?.input?.curationId)
    .then(
      fp.rejectIfEmpty(
        appError.buildNotFound(
          curationError.buildCurationNotFoundMsg(args?.input?.curationId),
          curationError.ErrorType.CurationNotFound,
        ),
      ),
    )
    .then(
      fp.rejectIf((curation: entity.Curation) => curation.userId !== user?.id)(
        appError.buildForbidden(curationError.buildCurationNotOwnedMsg(), curationError.ErrorType.CurationNotOwned),
      ),
    )
    .then(() => repositories.profile.findById(args?.input?.profileId))
    .then(
      fp.rejectIfEmpty(
        appError.buildNotFound(
          profileError.buildProfileNotFoundMsg(args?.input?.profileId),
          profileError.ErrorType.ProfileNotFound,
        ),
      ),
    )
    .then(
      fp.rejectIf((profile: entity.Profile) => profile.ownerUserId !== user?.id)(
        appError.buildForbidden(
          profileError.buildProfileNotOwnedMsg(args?.input?.profileId),
          profileError.ErrorType.ProfileNotOwned,
        ),
      ),
    )
    .then(
      fp.tapWait((profile: entity.Profile) =>
        repositories.edge.hardDelete({
          thisEntityId: profile.id,
          thisEntityType: defs.EntityType.Profile,
          edgeType: defs.EdgeType.Displays,
        }),
      ),
    )
    .then(
      fp.tapWait((profile: entity.Profile) =>
        repositories.edge.save({
          edgeType: defs.EdgeType.Displays,
          thatEntityId: args?.input?.curationId,
          thatEntityType: defs.EntityType.Curation,
          thisEntityId: profile.id,
          thisEntityType: defs.EntityType.Profile,
        }),
      ),
    )
}

const removeCurations = (_: any, args: gql.MutationRemoveCurationArgs, ctx: Context): Promise<gql.Profile> => {
  const { user, repositories } = ctx
  logger.debug('removeCuration', { loggedInUserId: user?.id, input: args?.input })

  const schema = Joi.object().keys({ profileId: Joi.string() })
  joi.validateSchema(schema, args?.input)

  return repositories.profile
    .findById(args?.input?.profileId)
    .then(
      fp.rejectIfEmpty(
        appError.buildNotFound(
          profileError.buildProfileNotFoundMsg(args?.input?.profileId),
          profileError.ErrorType.ProfileNotFound,
        ),
      ),
    )
    .then(
      fp.rejectIf((profile: entity.Profile) => profile.ownerUserId !== user?.id)(
        appError.buildForbidden(
          profileError.buildProfileNotOwnedMsg(args?.input?.profileId),
          profileError.ErrorType.ProfileNotOwned,
        ),
      ),
    )
    .then(
      fp.tapWait((profile: entity.Profile) =>
        repositories.edge.delete({
          thisEntityId: profile.id,
          thisEntityType: defs.EntityType.Profile,
          edgeType: defs.EdgeType.Displays,
        }),
      ),
    )
}

export default {
  Query: {
    myCurations: combineResolvers(auth.isAuthenticated, getMyCurations),
  },
  Mutation: {
    createCuration: combineResolvers(auth.isAuthenticated, createCuration),
    updateCuration: combineResolvers(auth.isAuthenticated, updateCuration),
    setCuration: combineResolvers(auth.isAuthenticated, setCuration),
    removeCuration: combineResolvers(auth.isAuthenticated, removeCurations),
  },
}
