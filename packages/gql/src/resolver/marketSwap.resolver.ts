import { Context, gql } from '@nftcom/gql/defs'
import { _logger, entity, helper } from '@nftcom/shared'

import { pagination } from '../helper'
import { core } from '../service'

const logger = _logger.Factory(_logger.Context.MarketSwap, _logger.Context.GraphQL)

const getSwaps = (
  _: any,
  args: gql.QueryGetSwapsArgs,
  ctx: Context,
): Promise<gql.GetMarketSwap> => {
  const { repositories } = ctx
  logger.debug('getSwaps', { input: args?.input })
  const pageInput = args?.input?.pageInput
  const { marketAskId } = helper.safeObject(args?.input)

  const filter: Partial<entity.MarketSwap> = helper.removeEmpty({
    askId: marketAskId,
  })
  return core.paginatedEntitiesBy(
    repositories.marketSwap,
    pageInput,
    filter,
  )
    .then(pagination.toPageable(pageInput))
}

export default {
  Query: {
    getSwaps: getSwaps,
  },
}
