import * as _ from 'lodash'

import { getChain } from '@src/config'
import { Context, entity, repository } from '@src/db'
import { EdgeType, EntityType, gqlTypes } from '@src/defs'
import { walletError } from '@src/graphql/error'
import { fp } from '@src/helper'
import { LoggerContext,LoggerFactory } from '@src/helper/logger'

const logger = LoggerFactory(LoggerContext.General, LoggerContext.GraphQL)

// TODO implement cache using data loader otherwise
//  some of these functions will have too many db calls

const getDefaultOrFindById = <T>(
  obj: T,
  id: string,
  findFn: (id: string) => Promise<T>,
  key = 'id',
): Promise<T> => {
  if (_.isEmpty(id) || obj[key] === id) {
    return Promise.resolve(obj)
  }
  return findFn(id)
}

export const getWallet = (
  ctx: Context,
  input: gqlTypes.WalletInput,
): Promise<entity.Wallet> => {
  const { network, chainId, address } = input
  const { user, repositories } = ctx
  logger.debug('getWallet', { loggedInUserId: user.id, input })

  const chain = getChain(network, chainId)
  return repositories.wallet
    .findByNetworkChainAddress(network, chainId, address)
    .then(fp.tapRejectIfEmpty(
      walletError.buildAddressAlreadyExistsError(network, chain, address),
    ))
}

// TODO can we use generics instead of any?
export const entityById = (
  ctx: Context,
  id: string,
  entityType: EntityType,
): Promise<any> => {
  const { repositories, user, wallet } = ctx
  logger.debug('entityById', { loggedInUserId: user.id, id, entityType })

  switch (entityType) {
  case EntityType.Approval:
    return repositories.approval.findById(id)
  case EntityType.Bid:
    return repositories.bid.findById(id)
  case EntityType.Edge:
    return repositories.edge.findById(id)
  case EntityType.NFT:
    return repositories.nft.findById(id)
  case EntityType.Profile:
    return repositories.profile.findById(id)
  case EntityType.User:
    return getDefaultOrFindById(user, id, repositories.user.findById)
  case EntityType.Wallet:
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

export const resolveEntityById = <T>(
  key: string,
  parentType: EntityType,
  resolvingType: EntityType,
) => {
  return <K>(parent: K, _: unknown, ctx: Context): Promise<T> => {
    return entityById(ctx, parent?.['id'], parentType)
      .then((p) => entityById(ctx, p?.[key], resolvingType))
  }
}

export const resolveEntityOwnership = (
  key: string,
  ctxKey: string,
  parentType: EntityType,
) => {
  return <T>(parent: T, _: unknown, ctx: Context): Promise<boolean> => {
    const ctxObj = ctx[ctxKey]
    return entityById(ctx, parent?.['id'], parentType)
      .then((p) => ctxObj?.['id'] === p?.[key])
  }
}

export const resolveEdgeOwnership = (ctxKey: string, edgeType: EdgeType) => {
  return <T>(parent: T, _: unknown, ctx: Context): Promise<boolean> => {
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
): Promise<T[]> => {
  // const { user } = ctx
  // logger.debug('entitiesBy', { loggedInUserId: user.id })
  return repo.find({ where: { ...filter } })
}

export const edgesBy = (
  edgeRepo: repository.EdgeRepository,
  filter: Partial<entity.Edge>,
): Promise<entity.Edge[]> => {
  return edgeRepo.find({ where: { ...filter, deleteAt: null } })
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

// export const thisEntitiesOfEdges = <T>(ctx: Context) => {
//   return (edges: entity.Edge[]): Promise<T[]> => {
//     return entitiesOfEdges<T>(ctx, edges, thisEntityOfEdge)
//   }
// }

export const thisEntitiesOfEdges = <T>(ctx: Context, edges: entity.Edge[]): Promise<T[]> => {
  return entitiesOfEdges<T>(ctx, edges, thisEntityOfEdge)
}

export const thisEntitiesOfEdgesBy = <T>(
  ctx: Context,
  filter: Partial<entity.Edge>,
): Promise<T[]> => {
  const { repositories } = ctx
  return edgesBy(repositories.edge, filter)
    .then(_.partialRight(thisEntitiesOfEdges, ctx))
}

export const thatEntityOfEdge = <T>(ctx: Context, edge: entity.Edge): Promise<T> => {
  return entityById(ctx, edge.thatEntityId, edge.thatEntityType)
}

// export const thatEntitiesOfEdges = <T>(ctx: Context) => {
//   return (edges: entity.Edge[]): Promise<T[]> => {
//     return entitiesOfEdges<T>(ctx, edges, thatEntityOfEdge)
//   }
// }

export const thatEntitiesOfEdges = <T>(ctx: Context, edges: entity.Edge[]): Promise<T[]> => {
  return entitiesOfEdges<T>(ctx, edges, thatEntityOfEdge)
}

export const thatEntitiesOfEdgesBy = <T>(
  ctx: Context,
  filter: Partial<entity.Edge>,
): Promise<T[]> => {
  const { repositories } = ctx
  return edgesBy(repositories.edge, filter)
    .then(_.partialRight(thatEntitiesOfEdges, ctx))
}
