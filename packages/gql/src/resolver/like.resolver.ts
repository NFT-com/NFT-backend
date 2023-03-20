import { combineResolvers } from 'graphql-resolvers'
import Joi from 'joi'

import { appError } from '@nftcom/error-types'
import { _logger, entity } from '@nftcom/shared'

import { Context, gql } from '../defs'
import { auth, joi } from '../helper'
import { likeService } from '../service/like.service'
import { profileService } from '../service/profile.service'

const logger = _logger.Factory('like.resolver', _logger.Context.GraphQL)

export const setLike =
  async (_: any, args: gql.MutationSetLikeArgs, ctx: Context): Promise<gql.Like> => {
    const schema = Joi.object().keys({
      likedById: Joi.string().required(),
      likedId: Joi.string().required(),
      likedType: Joi.string().valid(...Object.values(entity.LikeableType)).required(),
    })
    joi.validateSchema(schema, args.input)

    if (!ctx.user || !(await profileService.isProfileOwnedByUser(args.input.likedById, ctx.user.id))) {
      throw appError.buildForbidden('Cannot set like', 'LIKE_FORBIDDEN')
    }

    try {
      return likeService.setLike(args.input)
    } catch (err) {
      logger.error({ err, setLikeOptions: args.input }, 'Unable to set like for input')
      if (err.message.endsWith('already liked')) {
        throw appError.buildExists(err.message, 'LIKE_ALREADY_EXISTS')
      } else if (err.message.endsWith('cannot be liked')) {
        throw appError.buildInvalid(err.message, 'LIKE_INVALID')
      } else {
        throw appError.buildInternal()
      }
    }
  }

export default {
  Mutation: {
    setLike: combineResolvers(auth.isAuthenticated, setLike),
  },
}