import { Context, gql } from '@nftcom/gql/defs'
import { _logger } from '@nftcom/shared'

const logger = _logger.Factory(_logger.Context.Collection, _logger.Context.GraphQL)

const getCollection = (
  _: any,
  args: gql.QueryCollectionArgs,
  ctx: Context,
): Promise<gql.Collection> => {
  logger.debug('getCollection', { input: args?.input })

  return ctx.repositories.collection.findOne({
    where: {
      contract: args?.input?.contract,
    },
  })
}

export default {
  Query: {
    collection: getCollection,
  },
}