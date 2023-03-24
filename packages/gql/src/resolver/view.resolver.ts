import { ApolloError } from 'apollo-server-express'
import Joi from 'joi'

import { appError } from '@nftcom/error-types'
import { _logger, entity } from '@nftcom/shared'

import { Context, gql } from '../defs'
import { joi } from '../helper'
import { viewService } from '../service/view.service'

const logger = _logger.Factory('view.resolver', _logger.Context.GraphQL)

export const recordView =
  async (_: any, args: gql.MutationRecordViewArgs, _ctx: Context): Promise<boolean> => {
    const schema = Joi.object().keys({
      viewerId: Joi.string().required(),
      viewerType: Joi.string().valid(...Object.values(gql.ViewerType)).required(),
      viewedId: Joi.string().required(),
      viewedType: Joi.string().valid(...Object.values(entity.ViewableType)).required(),
    })
    joi.validateSchema(schema, args.input)

    const handleViewArgs = {
      ...args.input,
      viewerType: args.input.viewerType === gql.ViewerType.ProfileHolder
        ? entity.ViewerType.ProfileHolder
        : args.input.viewerType as entity.ViewerType,
    }
    try {
      return !!viewService.handleView(handleViewArgs)
    } catch (err) {
      logger.error({ err, handleViewArgs: args.input }, 'Unable to record view for input')
      if (!(err.originalError instanceof ApolloError)) {
        throw appError.buildInternal()
      }
      throw err
    }
  }

export default {
  Mutation: {
    recordView,
  },
}