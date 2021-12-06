import { getChain } from '@nftcom/gql/config'
import { Context, gql } from '@nftcom/gql/defs'
import { appError, walletError } from '@nftcom/gql/error'
import { pagination } from '@nftcom/gql/helper'
import { _logger, defs, entity, fp, helper, repository } from '@nftcom/shared'

const logger = _logger.Factory(_logger.Context.General, _logger.Context.GraphQL)

// TODO implement cache using data loader otherwise
//  some of these functions will have too many db calls

const getDefaultOrFindById = <T>(
  obj: T,
  id: string,
  findFn: (id: string) => Promise<T>,
  key = 'id',
): Promise<T> => {
  if (helper.isEmpty(id) || obj?.[key] === id) {
    return Promise.resolve(obj)
  }
  return findFn(id)
}

export const getWallet = (
  ctx: Context,
  input: gql.WalletInput,
): Promise<entity.Wallet> => {
  const { network, chainId, address } = input
  const { user, repositories } = ctx
  logger.debug('getWallet', { loggedInUserId: user?.id, input })

  const chain = getChain(network, chainId)
  return repositories.wallet
    .findByNetworkChainAddress(network, chainId, address)
    .then(fp.rejectIfEmpty(appError.buildExists(
      walletError.buildAddressExistsMsg(network, chain, address),
      walletError.ErrorType.AddressAlreadyExists,
    )))
}

// TODO can we use generics instead of any?
export const entityById = (
  ctx: Context,
  id: string,
  entityType: defs.EntityType,
): Promise<any> => {
  const { repositories, user, wallet } = ctx
  logger.debug('entityById', { loggedInUserId: user?.id, id, entityType })

  switch (entityType) {
  case defs.EntityType.Approval:
    return repositories.approval.findById(id)
  case defs.EntityType.Bid:
    return repositories.bid.findById(id)
  case defs.EntityType.Edge:
    return repositories.edge.findById(id)
  case defs.EntityType.NFT:
    return repositories.nft.findById(id)
  case defs.EntityType.Profile:
    return repositories.profile.findById(id)
  case defs.EntityType.User:
    return getDefaultOrFindById(user, id, repositories.user.findById)
  case defs.EntityType.Wallet:
    return getDefaultOrFindById(wallet, id, repositories.wallet.findById)
  default:
    throw new Error(`Cannot resolve entityType: ${entityType}`)
  }
}

export const resolveEntityFromContext = <T>(key: string) => {
  return (parent: unknown, _: unknown, ctx: Context): Promise<T> => {
    return ctx?.[key]
  }
}

export const resolveEntityById = <T, K>(
  key: string,
  parentType: defs.EntityType,
  resolvingType: defs.EntityType,
) => {
  return (parent: T, args: unknown, ctx: Context): Promise<K> => {
    return entityById(ctx, parent?.['id'], parentType)
      .then((p) => {
        if (helper.isEmpty(p?.[key])) {
          return null
        }
        return entityById(ctx, p?.[key], resolvingType)
      })
  }
}

export const resolveEntityOwnership = <T>(
  key: string,
  ctxKey: string,
  parentType: defs.EntityType,
) => {
  return (parent: T, _: unknown, ctx: Context): Promise<boolean> => {
    const ctxObj = ctx[ctxKey]
    return entityById(ctx, parent?.['id'], parentType)
      .then((p) => ctxObj?.['id'] === p?.[key])
  }
}

export const resolveEdgeOwnership = <T>(ctxKey: string, edgeType: defs.EdgeType) => {
  return (parent: T, _: unknown, ctx: Context): Promise<boolean> => {
    const ctxObj = ctx[ctxKey]
    const { repositories } = ctx
    return repositories.edge.exists({
      edgeType,
      thisEntityId: ctxObj?.['id'],
      thatEntityId: parent?.['id'],
      deletedAt: null,
    })
  }
}

export const entitiesBy = <T>(
  // ctx: Context,
  repo: repository.BaseRepository<T>,
  filter: Partial<T>,
  orderBy: defs.OrderBy = { createdAt: 'DESC' },
): Promise<T[]> => {
  // const { user } = ctx
  // logger.debug('entitiesBy', { loggedInUserId: user.id })
  return repo.find({ where: { ...filter, deletedAt: null }, order: orderBy })
}

/**
 * Cursor based pagination and by default it is sorted based on time desc
 * "before" and "after" in page terms refers to "later" and "earlier" respectively
 *
 *                                cursor
 *               |<-- last n before | first n after -->|
 * 12pm  11am  10am  9am  8am  7am  6am  5am  4am  3am  2am  1am
 */
export const paginatedEntitiesBy = <T>(
  repo: repository.BaseRepository<T>,
  pageInput: gql.PageInput,
  filter: Partial<T>,
  orderKey= 'createdAt',
  orderDirection = 'DESC',
  distinctOn?: defs.DistinctOn<T>,
): Promise<defs.PageableResult<T>> => {
  const pageableFilter = pagination.toPageableFilter(pageInput, filter, orderKey)
  const orderBy = <defs.OrderBy>{ [orderKey]: orderDirection }
  const reversedOrderDirection = orderDirection === 'DESC' ? 'ASC' : 'DESC'
  const reveredOrderBy = <defs.OrderBy>{ [orderKey]: reversedOrderDirection }

  return pagination.resolvePage<T>(pageInput, {
    firstAfter: () => repo.findPageable({
      filter: pageableFilter,
      orderBy,
      take: pageInput.first,
      distinctOn,
    }),
    firstBefore: () => repo.findPageable({
      filter: pageableFilter,
      orderBy,
      take: pageInput.first,
      distinctOn,
    }),
    lastAfter: () => repo.findPageable({
      filter: pageableFilter,
      orderBy: reveredOrderBy,
      take: pageInput.last,
      distinctOn,
    }).then(pagination.reverseResult),
    lastBefore: () => repo.findPageable({
      filter: pageableFilter,
      orderBy: reveredOrderBy,
      take: pageInput.last,
      distinctOn,
    }).then(pagination.reverseResult),
  })
}

const entitiesOfEdges = <T>(
  ctx: Context,
  edges: entity.Edge[],
  mapper: <T>(ctx: Context, edge: entity.Edge) => Promise<T>,
): Promise<T[]> => {
  return fp.promiseMap<entity.Edge, T>((edge) => mapper<T>(ctx, edge))(edges)
}

export const thisEntityOfEdge = <T>(ctx: Context, edge: entity.Edge): Promise<T> => {
  return entityById(ctx, edge.thisEntityId, edge.thisEntityType)
}

export const thisEntitiesOfEdges = <T>(ctx: Context) => {
  return (edges: entity.Edge[]): Promise<T[]> => {
    return entitiesOfEdges<T>(ctx, edges, thisEntityOfEdge)
  }
}

export const thisEntitiesOfEdgesBy = <T>(
  ctx: Context,
  filter: Partial<entity.Edge>,
): Promise<T[]> => {
  const { repositories } = ctx
  return entitiesBy(repositories.edge, filter)
    .then(thisEntitiesOfEdges<T>(ctx))
}

export const thatEntityOfEdge = <T>(ctx: Context, edge: entity.Edge): Promise<T> => {
  return entityById(ctx, edge.thatEntityId, edge.thatEntityType)
}

export const thatEntitiesOfEdges = <T>(ctx: Context) => {
  return (edges: entity.Edge[]): Promise<T[]> => {
    return entitiesOfEdges<T>(ctx, edges, thatEntityOfEdge)
  }
}

export const thatEntitiesOfEdgesBy = <T>(
  ctx: Context,
  filter: Partial<entity.Edge>,
): Promise<T[]> => {
  const { repositories } = ctx
  return entitiesBy(repositories.edge, filter)
    .then(thatEntitiesOfEdges(ctx))
}

// TODO use EdgeStats table
export const countEdges = (ctx: Context, filter: Partial<entity.Edge>): Promise<number> => {
  const { repositories } = ctx
  return repositories.edge.count({ ...filter, deletedAt: null })
}

export const createProfile = (
  ctx: Context,
  profile: Partial<entity.Profile>,
): Promise<entity.Profile> => {
  return ctx.repositories.profile.save(profile)
}

export const createEdge = (
  ctx: Context,
  edge: Partial<entity.Edge>,
): Promise<entity.Edge> => {
  return ctx.repositories.edge.save(edge)
}
