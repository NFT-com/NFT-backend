import { Context, gql } from '@nftcom/gql/defs'
import { _logger, entity,helper } from '@nftcom/shared'

import { pagination } from '../helper'
import { core } from '../service'

const logger = _logger.Factory(_logger.Context.MarketAsk, _logger.Context.GraphQL)

const getAsks = (
  _: any,
  args: gql.QueryGetAsksArgs,
  ctx: Context,
): Promise<gql.GetMarketAsk> => {
  const { repositories } = ctx
  logger.debug('getAsks', { input: args?.input })
  const pageInput = args?.input?.pageInput
  const { makerWalletId } = helper.safeObject(args?.input)

  const filter: Partial<entity.MarketAsk> = helper.removeEmpty({
    makerWalletId: makerWalletId,
  })
  return core.paginatedEntitiesBy(
    repositories.marketAsk,
    pageInput,
    filter,
  )
    .then(pagination.toPageable(pageInput))
}

export default {
  Query: {
    getAsks: getAsks,
  },
}
