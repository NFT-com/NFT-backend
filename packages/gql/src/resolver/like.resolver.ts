import { ApolloError } from 'apollo-server-express'
import { combineResolvers } from 'graphql-resolvers'
import Joi from 'joi'

import { appError } from '@nftcom/error-types'
import { _logger, entity } from '@nftcom/shared'

import { Context, gql } from '../defs'
import { auth, joi } from '../helper'
import { likeService } from '../service/like.service'

const logger = _logger.Factory('like.resolver', _logger.Context.GraphQL)

export const setLike =
  async (_: any, args: gql.MutationSetLikeArgs, ctx: Context): Promise<gql.Like> => {
    const schema = Joi.object().keys({
      likedById: Joi.string().required(),
      likedId: Joi.string().required(),
      likedType: Joi.string().valid(...Object.values(entity.LikeableType)).required(),
    })
    joi.validateSchema(schema, args.input)

    try {
      return likeService.setLike(args.input, ctx.user.id)
    } catch (err) {
      logger.error({ err, setLikeOptions: args.input }, 'Unable to set like for input')
      if (!(err.originalError instanceof ApolloError)) {
        throw appError.buildInternal()
      }
      throw err
    }
  }

export const unsetLike = (_: any, args: gql.MutationUnsetLikeArgs, ctx: Context): Promise<boolean> => {
  const schema = Joi.object().keys({
    likedById: Joi.string().required(),
    likedId: Joi.string().required(),
    likedType: Joi.string().valid(...Object.values(entity.LikeableType)).required(),
  })
  joi.validateSchema(schema, args.input)

  try {
    return likeService.unsetLike(args.input, ctx.user.id)
  } catch (err) {
    logger.error(err, 'Unable to unset like')
    if (!(err.originalError instanceof ApolloError)) {
      throw appError.buildInternal()
    }
    throw err
  }
}

export default {
  Mutation: {
    setLike: combineResolvers(auth.isAuthenticated, setLike),
    unsetLike: combineResolvers(auth.isAuthenticated, unsetLike),
  },
}