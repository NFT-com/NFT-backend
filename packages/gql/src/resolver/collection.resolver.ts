import { combineResolvers } from 'graphql-resolvers'
import Joi from 'joi'

import { Context, gql } from '@nftcom/gql/defs'
import { appError, collectionError, nftError, profileError } from '@nftcom/gql/error'
import { auth, joi, pagination } from '@nftcom/gql/helper'
import { core } from '@nftcom/gql/service'
import { _logger, defs, entity, fp, helper } from '@nftcom/shared'

const logger = _logger.Factory(_logger.Context.Collection, _logger.Context.GraphQL)

const getMyCollections = (
  _: any,
  args: gql.QueryMyCollectionsArgs,
  ctx: Context,
): Promise<gql.CollectionsOutput> => {
  const { user, repositories } = ctx
  logger.debug('getMyCollections', { loggedInUserId: user?.id, input: args?.input })
  const pageInput = args?.input?.pageInput
  const filter = helper.inputT2SafeK<entity.Collection>(args?.input, { userId: user.id })
  return core.paginatedEntitiesBy(
    repositories.collection,
    pageInput,
    filter,
  )
    .then(pagination.toPageable(pageInput))
}

const validateNFTOwnership = (
  ctx: Context,
  items: defs.CollectionItem[],
  user: entity.User,
): Promise<boolean> => {
  return Promise.all(
    items.map((item: defs.CollectionItem) => ctx.repositories.nft.findById(item.id)),
  )
    .then((nfts: entity.NFT[]) => !nfts.some((nft) => nft?.userId !== user.id))
}

const createCollection = (
  _: any,
  args: gql.MutationCreateCollectionArgs,
  ctx: Context,
): Promise<gql.Collection> => {
  const { user, repositories } = ctx
  logger.debug('createCollection', { loggedInUserId: user?.id, input: args?.input })

  const schema = Joi.object().keys({
    items: Joi.array().min(1).max(100).items(
      Joi.object().keys({
        id: Joi.string().required(),
        size: Joi.string().optional(),
      })),
  })
  joi.validateSchema(schema, args?.input)

  return validateNFTOwnership(ctx, args?.input?.items, user)
    .then(fp.rejectIfFalse(
      appError.buildForbidden(
        nftError.buildNFTNotOwnedMsg(),
        nftError.ErrorType.NFTNotOwned,
      ),
    ))
    .then(() => repositories.collection.save({
      userId: user?.id,
      items: args?.input?.items,
    }))
}

const updateCollection = (
  _: any,
  args: gql.MutationUpdateCollectionArgs,
  ctx: Context,
): Promise<gql.Collection> => {
  const { user, repositories } = ctx
  logger.debug('updateCollection', { loggedInUserId: user?.id, input: args?.input })

  const schema = Joi.object().keys({
    id: Joi.string().required(),
    items: Joi.array().min(1).max(100).items(
      Joi.object().keys({
        id: Joi.string().required(),
        size: Joi.string().optional(),
      })),
  })
  joi.validateSchema(schema, args?.input)

  return validateNFTOwnership(ctx, args?.input?.items, user)
    .then(fp.rejectIfFalse(appError.buildForbidden(
      nftError.buildNFTNotOwnedMsg(),
      nftError.ErrorType.NFTNotOwned,
    )))
    .then(() => repositories.collection.findById(args?.input?.id))
    .then(fp.rejectIfEmpty(
      appError.buildNotFound(
        collectionError.buildCollectionNotFoundMsg(args?.input?.id),
        collectionError.ErrorType.CollectionNotFound,
      ),
    ))
    .then(fp.rejectIf((collection: entity.Collection) => collection.userId !== user?.id)(
      appError.buildForbidden(
        collectionError.buildCollectionNotOwnedMsg(),
        collectionError.ErrorType.CollectionNotOwned,
      ),
    ))
    .then((collection: entity.Collection) => repositories.collection.save({
      ...collection,
      items: args?.input?.items,
    }))
}

const setCollection = (
  _: any,
  args: gql.MutationSetCollectionArgs,
  ctx: Context,
): Promise<gql.Profile> => {
  const { user, repositories } = ctx
  logger.debug('setCollection', { loggedInUserId: user?.id, input: args?.input })
  
  const schema = Joi.object().keys({ collectionId: Joi.string(), profileId: Joi.string() })
  joi.validateSchema(schema, args?.input)

  return repositories.collection.findById(args?.input?.collectionId)
    .then(fp.rejectIfEmpty(
      appError.buildNotFound(
        collectionError.buildCollectionNotFoundMsg(args?.input?.collectionId),
        collectionError.ErrorType.CollectionNotFound,
      ),
    ))
    .then(fp.rejectIf((collection: entity.Collection) => collection.userId !== user?.id)(
      appError.buildForbidden(
        collectionError.buildCollectionNotOwnedMsg(),
        collectionError.ErrorType.CollectionNotOwned,
      ),
    ))
    .then(() => repositories.profile.findById(args?.input?.profileId))
    .then(fp.rejectIfEmpty(
      appError.buildNotFound(
        profileError.buildProfileNotFoundMsg(args?.input?.profileId),
        profileError.ErrorType.ProfileNotFound,
      ),
    ))
    .then(fp.rejectIf((profile: entity.Profile) => profile.ownerUserId !== user?.id)(
      appError.buildForbidden(
        profileError.buildProfileNotOwnedMsg(args?.input?.profileId),
        profileError.ErrorType.ProfileNotOwned,
      ),
    ))
    .then(fp.tapWait(
      (profile: entity.Profile) => repositories.edge.delete({
        thisEntityId: profile.id,
        edgeType: defs.EdgeType.Displays,
      }),
    ))
    .then(fp.tapWait(
      (profile: entity.Profile) => repositories.edge.save({
        edgeType: defs.EdgeType.Displays,
        thatEntityId: args?.input?.collectionId,
        thisEntityId: profile.id,
      }),
    ))
}

export default {
  Query: {
    myCollections: combineResolvers(auth.isAuthenticated, getMyCollections),
  },
  Mutation: {
    createCollection: combineResolvers(auth.isAuthenticated, createCollection),
    updateCollection: combineResolvers(auth.isAuthenticated, updateCollection),
    setCollection: combineResolvers(auth.isAuthenticated, setCollection),
  },
}
