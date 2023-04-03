import { ApolloError } from 'apollo-server-express'
import { combineResolvers } from 'graphql-resolvers'
import Joi from 'joi'

import { appError } from '@nftcom/error-types'
import { _logger, entity } from '@nftcom/shared'

import { Context, gql } from '../defs'
import { auth, joi } from '../helper'
import { commentService } from '../service/comment.service'

const logger = _logger.Factory('comment.resolver', _logger.Context.GraphQL)

export const MAX_COMMENT_LENGTH = parseInt(process.env.MAX_COMMENT_LENGTH) || 300

export const addComment = async (_: any, args: gql.MutationAddCommentArgs, ctx: Context): Promise<gql.Comment> => {
  const schema = Joi.object().keys({
    authorId: Joi.string().required(),
    content: Joi.string().max(MAX_COMMENT_LENGTH).required(),
    entityId: Joi.string().required(),
    entityType: Joi.string()
      .valid(...Object.values(entity.SocialEntityType))
      .required(),
  })
  joi.validateSchema(schema, args.input)

  try {
    return commentService.addComment({ ...args.input, currentUserId: ctx.user.id })
  } catch (err) {
    logger.error({ err, addCommentOptions: args.input }, 'Unable to add comment for input')
    if (!(err.originalError instanceof ApolloError)) {
      throw appError.buildInternal()
    }
    throw err
  }
}

export const comments = async (_: any, args: gql.QueryCommentsArgs, _ctx: Context): Promise<gql.CommentsOutput> => {
  const schema = Joi.object().keys({
    entityId: Joi.string().required(),
    pageInput: Joi.object()
      .keys({
        first: Joi.number().optional(),
        last: Joi.number().optional(),
        afterCursor: Joi.string().optional(),
        beforeCursor: Joi.string().optional(),
      })
      .optional(),
  })
  joi.validateSchema(schema, args.input)

  try {
    return commentService.getComments({ ...args.input })
  } catch (err) {
    logger.error({ err, getCommentsOptions: args.input }, 'Unable to get comments for input')
    if (!(err.originalError instanceof ApolloError)) {
      throw appError.buildInternal()
    }
    throw err
  }
}

export default {
  Mutation: {
    addComment: combineResolvers(auth.isAuthenticated, addComment),
  },
  Query: {
    comments,
  },
}
