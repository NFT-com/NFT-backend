import { ethers, utils } from 'ethers'
import { combineResolvers } from 'graphql-resolvers'
import Redis from 'ioredis'
import Joi from 'joi'

import { createAlchemyWeb3 } from '@alch/alchemy-web3'
import { Context, gql, Pageable } from '@nftcom/gql/defs'
import { appError, curationError, nftError } from '@nftcom/gql/error'
import { auth, joi, pagination } from '@nftcom/gql/helper'
import { core } from '@nftcom/gql/service'
import { _logger, contracts, defs, entity, fp,helper } from '@nftcom/shared'

const logger = _logger.Factory(_logger.Context.NFT, _logger.Context.GraphQL)

import { differenceInMilliseconds } from 'date-fns'

import { redisConfig } from '@nftcom/gql/config'
import {
  checkNFTContractAddresses,
  initiateWeb3, syncEdgesWithNFTs, updateEdgesWeightForProfile,
  updateWalletNFTs,
} from '@nftcom/gql/service/nft.service'
import * as Sentry from '@sentry/node'
const redis = new Redis({
  port: redisConfig.port,
  host: redisConfig.host,
})
const PROFILE_NFTS_EXPIRE_DURATION = Number(process.env.PROFILE_NFTS_EXPIRE_DURATION)

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
    .then(fp.tap((nft) => {
      console.log(nft) // todo: refresh metadata?
    }))
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

const getGkNFTs = async (
  _: any,
  args: { tokenId: gql.Scalars['String'] },
  ctx: Context,
): Promise<gql.GetGkNFTsOutput> => {
  const { user } = ctx
  logger.debug('getGkNFTs', { loggedInUserId: user?.id  })

  const cachedData = await redis.get(`getGK${ethers.BigNumber.from(args?.tokenId).toString()}_${contracts.genesisKeyAddress(process.env.CHAIN_ID)}`)
  if (cachedData) {
    return JSON.parse(cachedData)
  } else {
    const ALCHEMY_API_URL = process.env.ALCHEMY_API_URL
    const web3 = createAlchemyWeb3(ALCHEMY_API_URL)

    try {
      const response: any = await web3.alchemy.getNftMetadata({
        contractAddress: contracts.genesisKeyAddress(process.env.CHAIN_ID),
        tokenId: ethers.BigNumber.from(args?.tokenId).toString(),
        tokenType: 'erc721',
      })

      await redis.set(
        `getGK${ethers.BigNumber.from(args?.tokenId).toString()}_${contracts.genesisKeyAddress(process.env.CHAIN_ID)}`,
        JSON.stringify(response),
        'ex',
        60 * 60, // 60 minutes
      )

      return response
    } catch (err) {
      Sentry.captureException(err)
      Sentry.captureMessage(`Error in getGKNFTs: ${err}`)
      throw nftError.buildNFTNotFoundMsg(args?.tokenId)
    }
  }
}

const updateNFTsForProfile = (
  _: any,
  args: gql.MutationUpdateNFTsForProfileArgs,
  ctx: Context,
): Promise<gql.NFTsOutput> => {
  try {
    const { repositories } = ctx
    logger.debug('updateNFTsForProfile', { input: args?.input })
    const pageInput = args?.input.pageInput
    initiateWeb3()
    return repositories.profile.findOne({ where: { id: args?.input.profileId } })
      .then((profile: entity.Profile | undefined) => {
        if (!profile) {
          return Promise.resolve({ items: [] })
        } else {
          const filter: Partial<entity.Edge> = helper.removeEmpty({
            thisEntityType: defs.EntityType.Profile,
            thisEntityId: profile.id,
            thatEntityType: defs.EntityType.NFT,
            edgeType: defs.EdgeType.Displays,
          })
          const now = helper.toUTCDate()
          let duration
          if (profile.nftsLastUpdated) {
            duration = differenceInMilliseconds(now, profile.nftsLastUpdated)
          }

          // if there is no profile NFT or NFTs are expired and need to be updated...
          if (!profile.nftsLastUpdated  ||
            (duration && duration > PROFILE_NFTS_EXPIRE_DURATION)
          ) {
            repositories.profile.updateOneById(profile.id, {
              nftsLastUpdated: now,
            }).then(() => repositories.wallet.findById(profile.ownerWalletId)
              .then((wallet: entity.Wallet) => {
                return checkNFTContractAddresses(profile.ownerUserId, wallet.id, wallet.address)
                  .then(() => {
                    return updateWalletNFTs(
                      profile.ownerUserId,
                      wallet.id,
                      wallet.address,
                    ).then(() => {
                      return updateEdgesWeightForProfile(profile.id, profile.ownerUserId)
                        .then(() => {
                          return syncEdgesWithNFTs(profile.id)
                        })
                    })
                  })
              }))
          }

          return core.paginatedThatEntitiesOfEdgesBy(
            ctx,
            repositories.nft,
            { ...filter, hide: false },
            pageInput,
            'createdAt',
            'ASC',
          )
        }
      })
  } catch (err) {
    Sentry.captureException(err)
    Sentry.captureMessage(`Error in updateNFTsForProfile: ${err}`)
  }
}

const getExternalListings = (
  _: any,
  args: gql.QueryExternalListingsArgs,
  ctx: Context,
): Promise<gql.ExternalListingsOutput> => {
  logger.debug('getExternalListings', {
    contract: args?.contract,
    id: args?.tokenId,
    caller: ctx.user?.id,
  })
  // todo: fetch listing info from 3rd party marketplaces.
  return null
}

export default {
  Query: {
    gkNFTs: getGkNFTs,
    nft: getContractNFT,
    nftById: getNFT,
    nfts: getNFTs,
    myNFTs: combineResolvers(auth.isAuthenticated, getMyNFTs),
    curationNFTs: getCurationNFTs,
    collectionNFTs: getCollectionNFTs,
    externalListings: getExternalListings,
  },
  Mutation: {
    refreshMyNFTs: combineResolvers(auth.isAuthenticated, refreshMyNFTs),
    updateNFTsForProfile: updateNFTsForProfile,
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
