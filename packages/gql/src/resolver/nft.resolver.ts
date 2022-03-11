import { utils } from 'ethers'
import { combineResolvers } from 'graphql-resolvers'
import Joi from 'joi'

import { Context, gql, Pageable } from '@nftcom/gql/defs'
import { appError, curationError, nftError } from '@nftcom/gql/error'
import { auth, joi, pagination } from '@nftcom/gql/helper'
import { checkNFTContractAddresses, updateWalletNFTs } from '@nftcom/gql/job/nft.job'
import { core } from '@nftcom/gql/service'
import { _logger, defs, entity, fp,helper } from '@nftcom/shared'

const logger = _logger.Factory(_logger.Context.NFT, _logger.Context.GraphQL)

const getNFT = (
  _: unknown,
  args: gql.QueryNFTByIdArgs,
  ctx: Context,
): Promise<gql.NFT> => {
  const { user, repositories } = ctx
  logger.debug('getNFT', { loggedInUserId: user?.id, input: args })
  const schema = Joi.object().keys({
    id: Joi.string().required(),
  })
  joi.validateSchema(schema, args)
  return repositories.nft.findById(args.id)
}

const getContractNFT = (
  _: unknown,
  args: gql.QueryNFTArgs,
  ctx: Context,
): Promise<gql.NFT> => {
  const { user, repositories } = ctx
  logger.debug('getContractNFT', { loggedInUserId: user?.id, input: args })
  const schema = Joi.object().keys({
    id: Joi.string().required(),
    contract: Joi.string().required(),
  })
  joi.validateSchema(schema, args)
  return repositories.nft.findOne({ where: {
    contract: args.contract,
    tokenId: args.id,
  } })
    .then(fp.rejectIfEmpty(
      appError.buildNotFound(
        nftError.buildNFTNotFoundMsg('collection ' + args.contract),
        nftError.ErrorType.NFTNotFound,
      ),
    ))
}

const getNFTs = (
  _: unknown,
  args: gql.QueryNFTsArgs,
  ctx: Context,
): Promise<gql.CurationNFTsOutput> => {
  const { user, repositories } = ctx
  logger.debug('getNFTs', { loggedInUserId: user?.id, input: args?.input })
  const { types, profileId } = helper.safeObject(args?.input)
  const filter: Partial<entity.NFT> = helper.removeEmpty({
    type: helper.safeInForOmitBy(types),
  })
  return core.thatEntitiesOfEdgesBy<entity.Curation>(ctx, {
    thisEntityId: profileId,
    thisEntityType: defs.EntityType.Profile,
    edgeType: defs.EdgeType.Displays,
  }).then((curations) => {
    if (curations == null || curations.length === 0) {
      // If no curations associated with this Profile,
      // (e.g. before user-curated curations are available)
      // we'll return all the owner's NFTs (at this wallet) 
      return repositories.profile.findById(profileId)
        .then((profile: entity.Profile) =>
          repositories.nft.findByWalletId(profile.ownerWalletId)
            .then((nfts: entity.NFT[]) =>
              Promise.all(nfts.map((nft: entity.NFT) => {
                return {
                  nft,
                  size: defs.NFTSize.Medium, // default
                }
              }))))
        .then((curationItems) => Promise.resolve({
          items: curationItems,
        }))
    } else {
      return Promise.all([
        // TODO: return array of Curations once we support multiple
        Promise.resolve(curations[0].items),
        Promise.all(curations[0].items.map(item =>
          repositories.nft.findOne({ where: { id: item.id, ...filter } }))),
      ]).then(([items, nfts]) => nfts
        .filter((nft) => nft !== null)
        .map((nft, index) => ({ nft: nft, size: items[index].size })))
        .then((nfts) => Promise.resolve({
          items: nfts,
        }))
    }
  })
}

const getMyNFTs = (
  _: unknown,
  args: gql.QueryNFTsArgs,
  ctx: Context,
): Promise<gql.NFTsOutput> => {
  const { user } = ctx
  logger.debug('getMyNFTs', { loggedInUserId: user.id, input: args?.input })
  const pageInput = args?.input?.pageInput
  const { types, profileId } = helper.safeObject(args?.input)

  const filters: Partial<entity.NFT>[] = [helper.removeEmpty({
    type: helper.safeInForOmitBy(types),
    userId: user.id,
    profileId,
  })]
  return core.paginatedEntitiesBy(
    ctx.repositories.nft,
    pageInput,
    filters,
    [], // relations
  )
    .then(pagination.toPageable(pageInput))
}

const getCurationNFTs = (
  _: unknown,
  args: gql.QueryCurationNFTsArgs,
  ctx: Context,
): Promise<gql.CurationNFTsOutput> => {
  const { repositories } = ctx
  logger.debug('getCurationNFTs', { input: args?.input })
  const { curationId } = helper.safeObject(args?.input)
  return repositories.curation.findById(curationId)
    .then(fp.rejectIfEmpty(
      appError.buildNotFound(
        curationError.buildCurationNotFoundMsg(curationId),
        curationError.ErrorType.CurationNotFound,
      ),
    ))
    .then((curation) => Promise.all([
      Promise.resolve(curation.items),
      Promise.all(curation.items.map(item =>  repositories.nft.findById(item.id))),
    ]))
    .then(([items, nfts]) => nfts.map((nft, index) => ({ nft: nft, size: items[index].size })))
    .then((nfts) => Promise.resolve({
      items: nfts,
    }))
}

const getCollectionNFTs = (
  _: unknown,
  args: gql.QueryCollectionNFTsArgs,
  ctx: Context,
): Promise<gql.NFTsOutput> => {
  const { repositories } = ctx
  logger.debug('getCollectionNFTs', { input: args?.input })
  const { pageInput, collectionAddress } = helper.safeObject(args?.input)

  return repositories.collection.findByContractAddress(utils.getAddress(collectionAddress))
    .then(fp.rejectIfEmpty(
      appError.buildNotFound(
        nftError.buildNFTNotFoundMsg('collection ' + collectionAddress),
        nftError.ErrorType.NFTNotFound,
      ),
    ))
    .then((collection: entity.Collection) => core.paginatedEntitiesBy(
      repositories.edge,
      pageInput,
      [{
        thisEntityId: collection.id,
        thisEntityType: defs.EntityType.Collection,
        thatEntityType: defs.EntityType.NFT,
        edgeType: defs.EdgeType.Includes,
      }],
      [], // relations
    ))
    .then(pagination.toPageable(pageInput))
    .then((resultEdges: Pageable<entity.Edge>) => Promise.all([
      Promise.all(
        resultEdges.items.map((edge: entity.Edge) => repositories.nft.findById(edge.thatEntityId)),
      ),
      Promise.resolve(resultEdges.pageInfo),
      Promise.resolve(resultEdges.totalItems),
    ]))
    .then(([nfts, pageInfo, count]: [entity.NFT[], gql.PageInfo, number]) => Promise.resolve({
      items: nfts ?? [],
      pageInfo,
      totalItems: count,
    }))
}

const refreshMyNFTs = (
  _: any,
  args: any,
  ctx: Context,
): Promise<gql.RefreshMyNFTsOutput> => {
  const { user, repositories } = ctx
  logger.debug('refreshNFTs', { loggedInUserId: user.id })
  return repositories.wallet.findByUserId(user.id)
    .then((wallets: entity.Wallet[]) => {
      return Promise.all(
        wallets.map((wallet: entity.Wallet) => {
          checkNFTContractAddresses(user.id, wallet.id, wallet.address)
            .then(() => {
              updateWalletNFTs(user.id, wallet.id, wallet.address)
            })
        }),
      ).then(() => {
        return { status: true, message: 'Your NFTs are updated!' }
      }).catch((err) => {
        return { status: false, message: err }
      })
    }).catch((err) => {
      return { status: false, message: err }
    })
}

export default {
  Query: {
    nft: getContractNFT,
    nftById: getNFT,
    nfts: getNFTs,
    myNFTs: combineResolvers(auth.isAuthenticated, getMyNFTs),
    curationNFTs: getCurationNFTs,
    collectionNFTs: getCollectionNFTs,
  },
  Mutation: {
    refreshMyNFTs: combineResolvers(auth.isAuthenticated, refreshMyNFTs),
  },
  NFT: {
    wallet: core.resolveEntityById<gql.NFT, entity.Wallet>(
      'walletId',
      defs.EntityType.NFT,
      defs.EntityType.Wallet,
    ),
    isOwnedByMe: core.resolveEntityOwnership<gql.NFT>(
      'userId',
      'user',
      defs.EntityType.NFT,
    ),
  },
}
