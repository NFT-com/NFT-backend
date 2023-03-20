import { ethers, utils } from 'ethers'
import { combineResolvers } from 'graphql-resolvers'
import Joi from 'joi'

import { createAlchemyWeb3 } from '@alch/alchemy-web3'
import { appError, curationError, nftError, profileError, txActivityError } from '@nftcom/error-types'
import { Context, gql, Pageable } from '@nftcom/gql/defs'
import { auth, joi, pagination } from '@nftcom/gql/helper'
import { core } from '@nftcom/gql/service'
import {
  _logger,
  contracts,
  db,
  defs,
  entity,
  fp,
  helper,
  utils as dbUtils,
} from '@nftcom/shared'

import { likeService } from '../service/like.service'

const logger = _logger.Factory(_logger.Context.NFT, _logger.Context.GraphQL)

// import { differenceInMilliseconds } from 'date-fns'
import { Maybe } from 'graphql/jsutils/Maybe'
import { IsNull } from 'typeorm'

import { cache, CacheKeys } from '@nftcom/cache'
import { PageInput } from '@nftcom/gql/defs/gql'
import { safeInput } from '@nftcom/gql/helper/pagination'
import { stringifyTraits } from '@nftcom/gql/service/core.service'
import { createLooksrareListing } from '@nftcom/gql/service/looksare.service'
import {
  checkNFTContractAddresses,
  getUserWalletFromNFT,
  initiateWeb3,
  profileGKNFT,
  profileOwner,
  saveNewNFT,
  updateCollectionForAssociatedContract,
  updateNFTMetadata,
  updateNFTOwnershipAndMetadata,
  updateNFTsForAssociatedAddresses,
  updateWalletNFTs,
} from '@nftcom/gql/service/nft.service'
import { createSeaportListing } from '@nftcom/gql/service/opensea.service'
import { SearchEngineService } from '@nftcom/gql/service/searchEngine.service'
import { triggerNFTOrderRefreshQueue } from '@nftcom/gql/service/txActivity.service'
import { createX2Y2Listing } from '@nftcom/gql/service/x2y2.service'
import * as Sentry from '@sentry/node'

// const PROFILE_NFTS_EXPIRE_DURATION = Number(process.env.PROFILE_NFTS_EXPIRE_DURATION)
// const PROFILE_SCORE_EXPIRE_DURATION = Number(process.env.PROFILE_SCORE_EXPIRE_DURATION)
// const REFRESH_NFT_DURATION = Number(process.env.REFRESH_NFT_DURATION)

// commented for future reference
// const baseCoins = [
//   {
//     symbol: 'ETH',
//     logoURI: 'https://openseauserdata.com/files/6f8e2979d428180222796ff4a33ab929.svg',
//     address: '0x0000000000000000000000000000000000000000',
//     decimals: 18,
//     chainId: 1,
//   },
//   {
//     symbol: 'ETH',
//     logoURI: 'https://openseauserdata.com/files/6f8e2979d428180222796ff4a33ab929.svg',
//     address: '0x0000000000000000000000000000000000000000',
//     decimals: 18,
//     chainId: 4,
//   },
//   {
//     symbol: 'WETH',
//     logoURI: 'https://openseauserdata.com/files/accae6b6fb3888cbff27a013729c22dc.svg',
//     address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
//     decimals: 18,
//     chainId: 1,
//   },
//   {
//     symbol: 'WETH',
//     logoURI: 'https://openseauserdata.com/files/accae6b6fb3888cbff27a013729c22dc.svg',
//     address: '0xc778417e063141139fce010982780140aa0cd5ab',
//     decimals: 18,
//     chainId: 4,
//   },
//   {
//     symbol: 'USDC',
//     logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
//     address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
//     decimals: 6,
//     chainId: 1,
//   },
//   {
//     symbol: 'USDC',
//     logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
//     address: '0x4dbcdf9b62e891a7cec5a2568c3f4faf9e8abe2b',
//     decimals: 6,
//     chainId: 4,
//   },
//   {
//     symbol: 'DAI',
//     logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x6B175474E89094C44Da98b954EedeAC495271d0F/logo.png',
//     address: '0x6b175474e89094c44da98b954eedeac495271d0f',
//     decimals: 18,
//     chainId: 1,
//   },
//   {
//     symbol: 'DAI',
//     logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x6B175474E89094C44Da98b954EedeAC495271d0F/logo.png',
//     address: '0x5592ec0cfb4dbc12d3ab100b257153436a1f0fea',
//     decimals: 18,
//     chainId: 4,
//   },
// ]

const seService = SearchEngineService()

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
    .then((nft: entity.NFT) => {
      // fix (short-term) : trait value
      return stringifyTraits(nft)
    })
}

const getContractNFT = async (
  _: unknown,
  args: gql.QueryNFTArgs,
  ctx: Context,
): Promise<gql.NFT> => {
  try {
    const { user, repositories } = ctx
    logger.debug('getContractNFT', { loggedInUserId: user?.id, input: args })
    const schema = Joi.object().keys({
      id: Joi.string().required(),
      contract: Joi.string().required(),
      chainId: Joi.string(),
    })
    joi.validateSchema(schema, args)
    const chainId = args?.chainId || process.env.CHAIN_ID
    auth.verifyAndGetNetworkChain('ethereum', chainId)
    initiateWeb3(chainId)

    let nft = await repositories.nft.findOne({
      where: {
        contract: utils.getAddress(args.contract),
        tokenId: ethers.BigNumber.from(args.id).toHexString(),
        chainId,
      },
    })
    if (nft) {
      // fix (short-term) : trait value
      nft = stringifyTraits(nft)

      // const now = helper.toUTCDate()
      // let duration
      // if (nft.lastRefreshed) {
      //   duration = differenceInMilliseconds(now, nft.lastRefreshed)
      // }
      // if (!nft.lastRefreshed  ||
      //   (duration && duration > REFRESH_NFT_DURATION)
      // ) {
      //   repositories.nft.updateOneById(nft.id, { lastRefreshed: now })
      //     .then((Nft) => {
      //       const obj = {
      //         contract: {
      //           address: Nft.contract,
      //         },
      //         id: {
      //           tokenId: Nft.tokenId,
      //         },
      //       }
      //       getUserWalletFromNFT(Nft.contract, Nft.tokenId, chainId)
      //         .then((wallet) => {
      //           if (!wallet) {
      //             logger.error('Failed to create new user and wallet for NFT ownership')
      //           } else {
      //             updateNFTOwnershipAndMetadata(
      //               obj,
      //               wallet.userId,
      //               wallet.id,
      //               chainId,
      //             ).then(() => {
      //               logger.info(`Updated NFT ownership and metadata for contract ${Nft.contract} and tokenId ${Nft.tokenId}`)
      //             })
      //           }
      //         })
      //     })
      // }
      return nft
    } else {
      // This NFT is not existing in our DB, so we try to get and save
      const newNFT = await saveNewNFT(
        utils.getAddress(args.contract),
        ethers.BigNumber.from(args.id).toHexString(),
        chainId,
      )
      if (!newNFT) {
        logger.error(`NFT is not valid for contract ${args?.contract} and tokenId ${ethers.BigNumber.from(args?.id).toHexString()}`)
        return Promise.reject(appError.buildInvalid(
          nftError.buildNFTNotValid(),
          nftError.ErrorType.NFTNotValid,
        ))
      } else {
        logger.info(`New NFT is saved for contract ${args?.contract} and tokenId ${ethers.BigNumber.from(args?.id).toHexString()}`)
        return newNFT
      }
    }
  } catch (err) {
    Sentry.captureMessage(`Error in getContractNFT: ${err}`)
    return err
  }
}

const returnProfileNFTs = async (
  profileId: string,
  ctx: Context,
  pageInput: PageInput,
  chainId: string,
  includeHidden: boolean,
  cacheKeyStr: string,
  query: string,
  invalidateCache?: boolean,
): Promise<any> => {
  try {
    let nfts: gql.NFT[] = []
    let cacheKey
    if (query && query?.length) {
      cacheKey = `${cacheKeyStr}_${chainId}_${profileId}_${query}`
    } else {
      cacheKey = `${cacheKeyStr}_${chainId}_${profileId}`
    }
    if (invalidateCache) {
      await cache.del([cacheKey])
    }
    const profile = await ctx.repositories.profile.findById(profileId)
    if (!profile) return
    let cachedData = await cache.get(cacheKey)
    if (cachedData) {
      // check profile owner and if owner is changed, we invalidate cached data
      const owner = await profileOwner(profile.url, chainId)
      if (owner && !profile.ownerWalletId) {
        await cache.del([cacheKey])
      } else if (owner && profile.ownerWalletId) {
        const wallet = await ctx.repositories.wallet.findById(profile.ownerWalletId)
        if (wallet && ethers.utils.getAddress(wallet.address) !== ethers.utils.getAddress(owner)) {
          await cache.del([cacheKey])
        }
      } else if (!owner && profile.ownerWalletId) {
        await cache.del([cacheKey])
      }
    }
    cachedData = await cache.get(cacheKey)
    if (cachedData) {
      nfts = JSON.parse(cachedData) as gql.NFT[]
    } else {
      const filter: Partial<entity.Edge> = helper.removeEmpty({
        thisEntityType: defs.EntityType.Profile,
        thisEntityId: profileId,
        thatEntityType: defs.EntityType.NFT,
        edgeType: defs.EdgeType.Displays,
      })
      const edges: entity.Edge[] = []
      const visibleEdges = await ctx.repositories.edge.find({
        where: {
          ...filter,
          hide: false,
        },
        order: {
          weight: 'ASC',
          updatedAt: 'DESC',
        },
      })
      edges.push(...visibleEdges)
      if (includeHidden) {
        const hiddenEdges = await ctx.repositories.edge.find({
          where: {
            ...filter,
            hide: true,
          },
          order: {
            updatedAt: 'DESC',
          },
        })
        edges.push(...hiddenEdges)
      }

      let index = 0
      for (const edge of edges) {
        const nft = await ctx.repositories.nft.findOne({ where: { id: edge.thatEntityId } })
        if (nft) {
          let isMatch = false
          if (query && query?.length) {
            if (nft.metadata.name && nft.metadata.name.toLowerCase().includes(query.toLowerCase())) {
              isMatch = true
            }
          } else {
            isMatch = true
          }
          const collection = await ctx.repositories.collection.findOne({
            where: {
              contract: ethers.utils.getAddress(nft.contract),
              isSpam: false,
              chainId,
            } })
          if (collection && isMatch) {
            nfts.push({
              sortIndex: index,
              isHide: edge.hide,
              ...nft,
            })
            index++
          }
        }
      }
      await cache.set(cacheKey, JSON.stringify(nfts), 'EX', 60 * 10) // 10 min
    }

    let paginatedNFTs: Array<gql.NFT>
    let defaultCursor
    if (!pagination.hasAfter(pageInput) && !pagination.hasBefore(pageInput)) {
      defaultCursor = pagination.hasFirst(pageInput) ? { beforeCursor: '-1' } :
        { afterCursor: nfts.length.toString() }
    }

    const safePageInput = safeInput(pageInput, defaultCursor)
    let totalItems
    if (pagination.hasFirst(safePageInput)) {
      const cursor = pagination.hasAfter(safePageInput) ?
        safePageInput.afterCursor : safePageInput.beforeCursor
      paginatedNFTs = nfts.filter((nft) => nft.sortIndex > Number(cursor))
      totalItems = paginatedNFTs.length
      paginatedNFTs = paginatedNFTs.slice(0, safePageInput.first)
    } else {
      const cursor = pagination.hasAfter(safePageInput) ?
        safePageInput.afterCursor : safePageInput.beforeCursor
      paginatedNFTs = nfts.filter((nft) => nft.sortIndex < Number(cursor))
      totalItems = paginatedNFTs.length
      paginatedNFTs = paginatedNFTs.slice(paginatedNFTs.length - safePageInput.last)
    }

    const result = pagination.toPageable(
      pageInput,
      paginatedNFTs[0],
      paginatedNFTs[paginatedNFTs.length - 1],
      'sortIndex',
    )([paginatedNFTs, totalItems])
    return triggerNFTOrderRefreshQueue(result.items, chainId)
      .then(() => Promise.resolve(result))
  } catch (err) {
    logger.error(`Error in returnProfileNFTs: ${err}`)
    throw err
  }
}

const getMyNFTs = async (
  _: unknown,
  args: gql.QueryMyNFTsArgs,
  ctx: Context,
): Promise<gql.NFTsOutput> => {
  const { user, chain, wallet, repositories } = ctx
  logger.debug('getMyNFTs', { loggedInUserId: user.id, input: args?.input })
  const pageInput = args?.input?.pageInput
  const chainId = chain.id || process.env.CHAIN_ID
  auth.verifyAndGetNetworkChain('ethereum', chainId)

  const schema = Joi.object().keys({
    profileId: Joi.string().optional(),
    ownedByWallet: Joi.boolean().optional(),
    chainId: Joi.string().optional(),
    pageInput: Joi.any(),
    types: Joi.array().optional(),
    query: Joi.string().optional(),
    invalidateCache: Joi.boolean().optional(),
  })
  const { input } = args
  joi.validateSchema(schema, input)

  try {
    const filters: Partial<entity.NFT> = {
      walletId: wallet.id,
      userId: user.id,
      chainId,
    }

    const query = args?.input.query
    if (args?.input?.ownedByWallet && args?.input?.profileId) {
      const profile = await ctx.repositories.profile.findById(args?.input?.profileId)
      if (!profile) {
        return Promise.reject(appError.buildNotFound(
          profileError.buildProfileNotFoundMsg(args?.input?.profileId),
          profileError.ErrorType.ProfileNotFound,
        ))
      }
      if (profile.ownerUserId !== user.id || profile.ownerWalletId !== wallet.id) {
        return Promise.reject(appError.buildNotFound(
          nftError.buildProfileNotOwnedMsg(profile?.url || profile?.id, user.id),
          nftError.ErrorType.NFTNotOwned,
        ))
      }
      return await returnProfileNFTs(
        args?.input.profileId,
        ctx,
        pageInput,
        chainId,
        true,
        CacheKeys.PROFILE_SORTED_NFTS,
        query,
        args?.input.invalidateCache,
      )
    } else if (!args?.input?.ownedByWallet && args?.input?.profileId) {
      const profile = await ctx.repositories.profile.findById(args?.input?.profileId)
      if (!profile) {
        return Promise.reject(appError.buildNotFound(
          profileError.buildProfileNotFoundMsg(args?.input?.profileId),
          profileError.ErrorType.ProfileNotFound,
        ))
      }
      return await returnProfileNFTs(
        args?.input.profileId,
        ctx,
        pageInput,
        chainId,
        true,
        CacheKeys.PROFILE_SORTED_NFTS,
        query,
        args?.input.invalidateCache,
      )
    } else if (args?.input?.ownedByWallet && !args?.input?.profileId) {
      const recentlyRefreshed: string = await cache.zscore(`${CacheKeys.UPDATED_NFTS_NON_PROFILE}_${chainId}`, wallet.id)
      if (!recentlyRefreshed) {
        // add to NFT cache list
        await cache.zadd(`${CacheKeys.UPDATE_NFTS_NON_PROFILE}_${chainId}`, 'INCR', 1, wallet.id)
      }
      return core.paginatedEntitiesBy(
        repositories.nft,
        pageInput,
        [filters],
        [],
        'updatedAt',
        'DESC',
      )
        .then(pagination.toPageable(pageInput, null, null, 'updatedAt'))
        .then(result => {
          // refresh order queue trigger
          return Promise.resolve(triggerNFTOrderRefreshQueue(result?.items, chainId))
            .then(() => Promise.resolve(result))
        }) as Promise<gql.NFTsOutput>
    } else {
      const defaultProfile = await repositories.profile.findOne({
        where: {
          ownerUserId: user.id,
          ownerWalletId: wallet.id,
          chainId,
        },
      })
      if (!defaultProfile) {
        const recentlyRefreshed: string = await cache.zscore(`${CacheKeys.UPDATED_NFTS_NON_PROFILE}_${chainId}`, wallet.id)
        if (!recentlyRefreshed) {
          // add to NFT cache list
          await cache.zadd(`${CacheKeys.UPDATE_NFTS_NON_PROFILE}_${chainId}`, 'INCR', 1, wallet.id)
        }
        return core.paginatedEntitiesBy(
          repositories.nft,
          pageInput,
          [filters],
          [],
          'updatedAt',
          'DESC',
        )
          .then(pagination.toPageable(pageInput, null, null, 'updatedAt'))
          .then(result => {
            // refresh order queue trigger
            return Promise.resolve(triggerNFTOrderRefreshQueue(result?.items, chainId))
              .then(() => Promise.resolve(result))
          }) as Promise<gql.NFTsOutput>
      } else {
        return await returnProfileNFTs(
          defaultProfile.id,
          ctx,
          pageInput,
          chainId,
          true,
          CacheKeys.PROFILE_SORTED_NFTS,
          query,
          args?.input.invalidateCache,
        )
      }
    }
  } catch (err) {
    Sentry.captureMessage(`Error in getMyNFTs: ${err}`)
    return err
  }
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
  const chainId = args?.input.chainId || process.env.CHAIN_ID
  auth.verifyAndGetNetworkChain('ethereum', chainId)

  return repositories.collection.findByContractAddress(
    utils.getAddress(collectionAddress),
    chainId,
  )
    .then(fp.rejectIfEmpty(
      appError.buildNotFound(
        nftError.buildNFTNotFoundMsg('collection ' + collectionAddress + ' on chain ' + chainId),
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
        resultEdges.items.map((edge: entity.Edge) => {
          return repositories.nft.findOne({
            where: {
              id: edge.thatEntityId,
              chainId: chainId,
            },
          }).then((nft) => {
            // fix (short-term) : trait value
            return stringifyTraits(nft)
          })
        }),
      ),
      Promise.resolve(resultEdges.pageInfo),
      Promise.resolve(resultEdges.totalItems),
    ]))
    .then(([nfts, pageInfo, count]: [entity.NFT[], gql.PageInfo, number]) => {
      // refresh order queue trigger
      return Promise.resolve(triggerNFTOrderRefreshQueue(nfts, chainId))
        .then(() => Promise.resolve({
          items: nfts ?? [],
          pageInfo,
          totalItems: count,
        }),
        )
    })
}

const refreshMyNFTs = (
  _: any,
  args: any,
  ctx: Context,
): Promise<gql.RefreshMyNFTsOutput> => {
  const { user, repositories } = ctx
  const chainId = ctx.chain.id || process.env.CHAIN_ID
  auth.verifyAndGetNetworkChain('ethereum', chainId)
  initiateWeb3(chainId)
  logger.debug('refreshNFTs', { loggedInUserId: user.id })
  return repositories.wallet.findByUserId(user.id)
    .then((wallets: entity.Wallet[]) => {
      return Promise.all(
        wallets.map((wallet: entity.Wallet) => {
          checkNFTContractAddresses(user.id, wallet.id, wallet.address, wallet.chainId)
            .then(() => {
              updateWalletNFTs(user.id, wallet, wallet.chainId)
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
  args: gql.QueryGkNFTsArgs,
  ctx: Context,
): Promise<gql.GetGkNFTsOutput> => {
  const { user } = ctx
  logger.debug('getGkNFTs', { loggedInUserId: user?.id  })

  const chainId = args?.chainId || process.env.CHAIN_ID
  auth.verifyAndGetNetworkChain('ethereum', chainId)

  const cacheKey = `${CacheKeys.GET_GK}_${ethers.BigNumber.from(args?.tokenId).toString()}_${contracts.genesisKeyAddress(chainId)}`
  const cachedData = await cache.get(cacheKey)
  if (cachedData) {
    return JSON.parse(cachedData)
  } else {
    const ALCHEMY_API_URL = Number(chainId) == 1 ? process.env.ALCHEMY_API_URL : process.env.ALCHEMY_API_URL_GOERLI
    const web3 = createAlchemyWeb3(ALCHEMY_API_URL)

    try {
      const response: any = await web3.alchemy.getNftMetadata({
        contractAddress: contracts.genesisKeyAddress(chainId),
        tokenId: ethers.BigNumber.from(args?.tokenId).toString(),
        tokenType: 'erc721',
      })

      await cache.set(
        cacheKey,
        JSON.stringify(response),
        'EX',
        60 * 60, // 60 minutes
      )

      return response
    } catch (err) {
      Sentry.captureMessage(`Error in getGKNFTs: ${err}`)
      throw nftError.buildNFTNotFoundMsg(args?.tokenId)
    }
  }
}

const saveIncentiveActionsForProfile = async (
  repositories: db.Repository,
  profile: entity.Profile,
): Promise<void> => {
  // save incentive action for CREATE_NFT_PROFILE
  const createAction = await repositories.incentiveAction.findOne({
    where: {
      profileUrl: profile.url,
      userId: profile.ownerUserId ?? IsNull(),
      task: defs.ProfileTask.CREATE_NFT_PROFILE,
    },
  })
  if (!createAction) {
    await repositories.incentiveAction.save({
      profileUrl: profile.url,
      userId: profile.ownerUserId,
      task: defs.ProfileTask.CREATE_NFT_PROFILE,
      point: defs.ProfileTaskPoint.CREATE_NFT_PROFILE,
    })
  }
  // save incentive action for CUSTOMIZE_PROFILE
  if (profile.description && profile.photoURL) {
    const edges = await repositories.edge.find({
      where: {
        thisEntityType: defs.EntityType.Profile,
        thisEntityId: profile.id,
        thatEntityType: defs.EntityType.NFT,
        edgeType: defs.EdgeType.Displays,
        hide: false,
      },
    })
    if (edges.length) {
      const customizeAction = await repositories.incentiveAction.findOne({
        where: {
          profileUrl: profile.url,
          userId: profile.ownerUserId ?? IsNull(),
          task: defs.ProfileTask.CUSTOMIZE_PROFILE,
        },
      })
      if (!customizeAction) {
        await repositories.incentiveAction.save({
          profileUrl: profile.url,
          userId: profile.ownerUserId,
          task: defs.ProfileTask.CUSTOMIZE_PROFILE,
          point: defs.ProfileTaskPoint.CUSTOMIZE_PROFILE,
        })
      }
    }
  }
}

const updateNFTsForProfile = async (
  _: any,
  args: gql.MutationUpdateNFTsForProfileArgs,
  ctx: Context,
): Promise<gql.NFTsOutput> => {
  try {
    const { repositories } = ctx
    logger.debug('updateNFTsForProfile', { input: args?.input })
    const chainId = args?.input.chainId || process.env.CHAIN_ID
    auth.verifyAndGetNetworkChain('ethereum', chainId)

    const pageInput = args?.input.pageInput
    initiateWeb3(chainId)

    const profile = await repositories.profile.findOne({
      where: {
        id: args?.input.profileId,
        chainId,
      },
    })

    if (!profile) {
      return Promise.resolve({ items: [] })
    }

    await saveIncentiveActionsForProfile(repositories, profile)

    const recentlyRefreshed: string = await cache.zscore(`${CacheKeys.UPDATED_NFTS_PROFILE}_${chainId}`, profile.url)
    if (!recentlyRefreshed) {
      // add to NFT cache list
      await cache.zadd(`${CacheKeys.UPDATE_NFTS_PROFILE}_${chainId}`, 'INCR', 1, profile.url)
    }

    return await returnProfileNFTs(
      profile.id,
      ctx,
      pageInput,
      chainId,
      false,
      CacheKeys.PROFILE_SORTED_VISIBLE_NFTS,
      args?.input.query,
    )
  } catch (err) {
    Sentry.captureMessage(`Error in updateNFTsForProfile: ${err}`)
    return err
  }
}

const updateAssociatedAddresses = async (
  _: any,
  args: gql.MutationUpdateAssociatedAddressesArgs,
  ctx: Context,
): Promise<gql.UpdateAssociatedAddressesOutput> => {
  try {
    const { repositories } = ctx
    logger.debug('updateAssociatedAddresses', { input: args?.input })
    const chainId = args?.input.chainId || process.env.CHAIN_ID
    auth.verifyAndGetNetworkChain('ethereum', chainId)

    initiateWeb3(chainId)
    const profile = await repositories.profile.findOne({
      where: {
        url: args?.input.profileUrl,
        chainId,
      },
    })
    if (!profile) {
      return { message: `No profile with url ${args?.input.profileUrl}` }
    }
    const message = await updateNFTsForAssociatedAddresses(repositories, profile, chainId)
    return { message }
  } catch (err) {
    Sentry.captureMessage(`Error in updateAssociatedAddresses: ${err}`)
    return err
  }
}

const updateAssociatedContract = async (
  _: any,
  args: gql.MutationUpdateAssociatedContractArgs,
  ctx: Context,
): Promise<gql.UpdateAssociatedContractOutput> => {
  try {
    const { repositories } = ctx
    logger.debug('updateAssociatedContract', { input: args?.input })
    const chainId = args?.input.chainId || process.env.CHAIN_ID
    auth.verifyAndGetNetworkChain('ethereum', chainId)

    initiateWeb3(chainId)
    const profile = await repositories.profile.findOne({
      where: {
        url: args?.input.profileUrl,
        chainId,
      },
    })
    if (!profile) {
      return { message: `No profile with url ${args?.input.profileUrl}` }
    }
    const wallet = await repositories.wallet.findById(profile.ownerWalletId)
    const message = await updateCollectionForAssociatedContract(
      repositories,
      profile,
      chainId,
      wallet.address,
    )
    return { message }
  } catch (err) {
    Sentry.captureMessage(`Error in updateAssociatedContract: ${err}`)
    return err
  }
}

export const refreshNft = async (
  _: any,
  args: gql.MutationRefreshNFTArgs,
  ctx: Context,
): Promise<gql.NFT> => {
  try {
    const { repositories } = ctx
    logger.debug('refreshNft', { id: args?.id, chainId: args?.chainId })
    const chainId = args?.chainId || process.env.CHAIN_ID
    auth.verifyAndGetNetworkChain('ethereum', chainId)

    initiateWeb3(chainId)

    let nft = await repositories.nft.findOne({
      where: {
        id: args?.id,
        chainId,
      },
    })

    if (nft) {
      // fix (short-term) : trait value
      nft = stringifyTraits(nft)

      const obj = {
        contract: {
          address: nft.contract,
        },
        id: {
          tokenId: nft.tokenId,
        },
      }

      const wallet = await getUserWalletFromNFT(nft.contract, nft.tokenId, chainId)
      let refreshedNFT
      if (!wallet) {
        logger.info({ nft, chainId }, 'NFT ownership unavailable or ERC1155')
        const currentWallet = await repositories.wallet.findById(nft.walletId)
        refreshedNFT = await updateNFTOwnershipAndMetadata(obj, currentWallet.userId, currentWallet, chainId)
      } else {
        refreshedNFT = await updateNFTOwnershipAndMetadata(obj, wallet.userId, wallet, chainId)
      }
      if (refreshedNFT) {
        await seService.indexNFTs([refreshedNFT])

        return refreshedNFT
      }
      return nft
    } else {
      return Promise.reject(appError.buildNotFound(
        nftError.buildNFTNotFoundMsg('NFT: ' + args?.id),
        nftError.ErrorType.NFTNotFound,
      ))
    }
  } catch (err) {
    Sentry.captureMessage(`Error in refreshNft: ${err}`)
    return err
  }
}

// @TODO: Force Refresh as a second iteration
export const refreshNFTOrder = async (  _: any,
  args: gql.MutationRefreshNFTOrderArgs,
  ctx: Context): Promise<string> => {
  const { repositories, chain } = ctx
  logger.debug('refreshNftOrders', { id: args?.id })
  initiateWeb3()
  try {
    const nft = await repositories.nft.findById(args?.id)
    if (!nft) {
      return Promise.reject(appError.buildNotFound(
        nftError.buildNFTNotFoundMsg('NFT: ' + args?.id),
        nftError.ErrorType.NFTNotFound,
      ))
    }

    const recentlyRefreshed: string = await cache.zscore(`${CacheKeys.REFRESHED_NFT_ORDERS_EXT}_${chain.id}`, `${nft.contract}:${nft.tokenId}`)
    if (!args.force && recentlyRefreshed) {
      return 'Refreshed Recently! Try in sometime!'
    }

    let nftCacheId = `${nft.contract}:${nft.tokenId}`

    if (args?.force) {
      nftCacheId += ':force'
    } else {
      if (args?.ttl === null) {
        nftCacheId += ':manual'
      }

      if(args?.ttl) {
        const ttlDate: Date = new Date(args?.ttl)
        const now: Date = new Date()
        if (ttlDate && ttlDate > now) {
          nftCacheId += `:${ttlDate.getTime()}`
        }
      }
    }
    // add to cache list
    await cache.zadd(`${CacheKeys.REFRESH_NFT_ORDERS_EXT}_${chain.id}`, 'INCR', 1, nftCacheId)
    return 'Added to queue! Check back shortly!'
  } catch (err) {
    Sentry.captureMessage(`Error in refreshNftOrders: ${err}`)
    return err
  }
}

export const updateNFTMemo = async (
  _: any,
  args: gql.MutationUpdateNFTMemoArgs,
  ctx: Context,
): Promise<gql.NFT> => {
  const { repositories, chain } = ctx
  logger.debug('updateNFTMemo', { id: args?.nftId })
  const chainId = chain.id || process.env.CHAIN_ID
  auth.verifyAndGetNetworkChain('ethereum', chainId)
  try {
    let nft = await repositories.nft.findById(args?.nftId)
    if (!nft) {
      return Promise.reject(appError.buildNotFound(
        nftError.buildNFTNotFoundMsg('NFT: ' + args?.nftId),
        nftError.ErrorType.NFTNotFound,
      ))
    }

    if (args?.memo && args?.memo.length > 2000) {
      return Promise.reject(appError.buildNotFound(
        nftError.buildMemoTooLong(),
        nftError.ErrorType.MemoTooLong,
      ))
    }
    nft = await repositories.nft.updateOneById(nft.id, { memo: args?.memo })
    // fix (short-term) : trait value
    return stringifyTraits(nft)
  } catch (err) {
    Sentry.captureMessage(`Error in updateNFTMemo: ${err}`)
    return err
  }
}

export const getNFTsForCollections = async (
  _: any,
  args: gql.QueryNFTsForCollectionsArgs,
  ctx: Context,
): Promise<gql.CollectionNFT[]> => {
  const { repositories } = ctx
  logger.debug('getNFTsForCollections', { input: args?.input })
  const chainId = args?.input.chainId || process.env.CHAIN_ID
  auth.verifyAndGetNetworkChain('ethereum', chainId)
  try {
    const { collectionAddresses, count } = helper.safeObject(args?.input)
    const result: gql.CollectionNFT[] = []

    for (const collectionAddress of collectionAddresses) {
      try {
        const collection = await repositories.collection.findByContractAddress(
          ethers.utils.getAddress(collectionAddress),
          chainId,
        )
        if (collection) {
          const actualNFTCount = await repositories.edge.count({
            thisEntityType: defs.EntityType.Collection,
            thisEntityId: collection.id,
            thatEntityType: defs.EntityType.NFT,
            edgeType: defs.EdgeType.Includes,
          })
          const key = `NFTsForCollections_${chainId}_${ethers.utils.getAddress(collectionAddress)}_${count}`
          const cachedData = await cache.get(key)
          let nfts = []

          if (cachedData) {
            nfts = JSON.parse(cachedData) as entity.NFT[]
          } else {
            const edges = await repositories.edge.find({
              where: {
                thisEntityType: defs.EntityType.Collection,
                thisEntityId: collection.id,
                thatEntityType: defs.EntityType.NFT,
                edgeType: defs.EdgeType.Includes,
              },
              take: count,
            })
            if (edges.length) {
              for (const edge of edges) {
                let nft = await repositories.nft.findById(edge.thatEntityId)
                if (nft) {
                  // fix (short-term) : trait value
                  nft = stringifyTraits(nft)
                  nfts.push(nft)
                }
              }
              logger.info(`${nfts.length} NFTs for collection ${collectionAddress}`)
            }
            await cache.set(key, JSON.stringify(nfts), 'EX', 60 * 30)
          }

          const length = Math.min(nfts.length, count)
          const slicedNfts: entity.NFT[] = nfts.slice(0, length)

          // refresh order queue trigger
          await triggerNFTOrderRefreshQueue(slicedNfts, chainId)
          result.push({
            collectionAddress: ethers.utils.getAddress(collectionAddress),
            nfts: slicedNfts,
            actualNumberOfNFTs: actualNFTCount,
          })
        } else {
          result.push({
            collectionAddress: ethers.utils.getAddress(collectionAddress),
            nfts: [],
            actualNumberOfNFTs: 0,
          })
        }
      } catch (err) {
        logger.error(`Error in getNFTsForCollections: ${err}`)
        Sentry.captureMessage(`Error in getNFTsForCollections: ${err}`)
      }
    }
    return result
  } catch (err) {
    logger.error(`Error in getNFTsForCollections: ${err}`)
    Sentry.captureMessage(`Error in getNFTsForCollections: ${err}`)
    return err
  }
}

export const updateNFTProfileId =
  async (_: any, args: gql.MutationUpdateNFTProfileIdArgs, ctx: Context):
  Promise<gql.NFT> => {
    const schema = Joi.object().keys({
      nftId: Joi.string().required(),
      profileId: Joi.string().required(),
    })
    joi.validateSchema(schema, args)

    const { repositories, wallet } = ctx
    const { nftId, profileId } = args
    const [nft, profile] = await Promise.all([
      repositories.nft.findById(nftId),
      repositories.profile.findById(profileId),
    ])

    if (!nft) {
      throw appError.buildNotFound(
        nftError.buildNFTNotFoundMsg(nftId),
        nftError.ErrorType.NFTNotFound,
      )
    } else if (nft.walletId !== wallet.id) {
      throw appError.buildForbidden(
        nftError.buildNFTNotOwnedMsg(),
        nftError.ErrorType.NFTNotOwned,
      )
    }
    if (!profile) {
      throw appError.buildNotFound(
        profileError.buildProfileNotFoundMsg(profileId),
        profileError.ErrorType.ProfileNotFound,
      )
    } else if (profile.ownerWalletId !== wallet.id) {
      throw appError.buildForbidden(
        profileError.buildProfileNotOwnedMsg(profile.id),
        profileError.ErrorType.ProfileNotOwned,
      )
    }

    const updatedNFT =  await repositories.nft.updateOneById(nft.id, {
      profileId: profile.id,
    })
    // fix (short-term) : trait value
    return stringifyTraits(updatedNFT)
  }

const addListNFTsIncentiveAction = async (
  repositories: db.Repository,
  url: Maybe<string>,
  chainId: string,
  order: entity.TxOrder,
): Promise<boolean> => {
  try {
    if (!url || !url.length) {
      return !!order.id
    } else {
      const profile = await repositories.profile.findByURL(url, chainId)
      if (profile) {
        const existingAction = await repositories.incentiveAction.findOne({
          where: {
            userId: profile.ownerUserId ?? IsNull(),
            profileUrl: profile.url,
            task: defs.ProfileTask.LIST_NFTS,
          },
        })
        if (!existingAction) {
          await repositories.incentiveAction.save({
            userId: profile.ownerUserId,
            profileUrl: profile.url,
            task: defs.ProfileTask.LIST_NFTS,
            point: defs.ProfileTaskPoint.LIST_NFTS,
          })
        }
        return !!order.id
      } else {
        return Promise.reject(appError.buildInvalid(
          profileError.buildProfileUrlNotFoundMsg(url, chainId),
          profileError.ErrorType.ProfileNotFound,
        ))
      }
    }
  } catch (err) {
    logger.error(`Error in addListNFTsIncentiveAction: ${err}`)
    throw err
  }
}

export const listNFTSeaport = async (
  _: any,
  args: gql.MutationListNFTSeaportArgs,
  ctx: Context,
): Promise<any> => {
  const { repositories } = ctx
  const chainId = args?.input?.chainId || process.env.CHAIN_ID
  const seaportSignature = args?.input?.seaportSignature
  const seaportParams = args?.input?.seaportParams
  const profileUrl = args?.input.profileUrl

  logger.debug('listNFTSeaport', { input: args?.input, wallet: ctx?.wallet?.id })

  return createSeaportListing(seaportSignature, seaportParams, chainId)
    .then(fp.thruIfNotEmpty((order: entity.TxOrder) => {
      return repositories.txOrder.save({ ...order, createdInternally: true, memo: args?.input.memo ?? null })
    }))
    .then((order) => {
      return Promise.all([
        addListNFTsIncentiveAction(repositories, profileUrl, chainId, order),
        dbUtils.getNFTsFromTxOrders([order]).then(seService.indexNFTs),
      ]).then(results => results[0])
    })
    .catch(err => appError.buildInvalid(
      txActivityError.buildOpenSea(err),
      txActivityError.ErrorType.OpenSea,
    ))
}

export const listNFTLooksrare = async (
  _: any,
  args: gql.MutationListNFTLooksrareArgs,
  ctx: Context,
): Promise<any> => {
  const { repositories } = ctx
  const chainId = args?.input?.chainId || process.env.CHAIN_ID
  const looksrareOrder = args?.input?.looksrareOrder
  const profileUrl = args?.input.profileUrl

  logger.debug('listNFTLooksrare', { input: args?.input, wallet: ctx?.wallet?.id })

  return createLooksrareListing(looksrareOrder, chainId)
    .then(fp.thruIfNotEmpty((order: entity.TxOrder) => {
      return repositories.txOrder.save({ ...order, createdInternally: true, memo: args?.input.memo ?? null })
    }))
    .then((order) => {
      return Promise.all([
        addListNFTsIncentiveAction(repositories, profileUrl, chainId, order),
        dbUtils.getNFTsFromTxOrders([order]).then(seService.indexNFTs),
      ]).then(results => results[0])
    })
    .catch(err => appError.buildInvalid(
      txActivityError.buildLooksRare(err),
      txActivityError.ErrorType.LooksRare,
    ))
}

export const listNFTX2Y2 = async (
  _: any,
  args: gql.MutationListNFTx2Y2Args,
  ctx: Context,
): Promise<any> => {
  const { repositories } = ctx
  const schema = Joi.object().keys({
    input: Joi.object().keys({
      x2y2Order: Joi.string().required(),
      maker: Joi.string().required(),
      contract: Joi.string().required(),
      tokenId: Joi.string().required(),
      chainId: Joi.string().optional(),
      profileUrl: Joi.string().optional(),
    }),
  })
  joi.validateSchema(schema, args)
  const chainId = args?.input?.chainId || process.env.CHAIN_ID
  const x2y2Order = args?.input?.x2y2Order
  const profileUrl = args?.input?.profileUrl
  const maker = args?.input?.maker
  const contract = args?.input?.contract
  const tokenId = args?.input?.tokenId

  logger.debug({ input: args?.input, wallet: ctx?.wallet?.id }, 'listNFTX2Y2')

  return createX2Y2Listing(x2y2Order, maker, contract, tokenId, chainId)
    .then(fp.thruIfNotEmpty((order: entity.TxOrder) => {
      return repositories.txOrder.save({ ...order, createdInternally: true, memo: args?.input.memo ?? null })
    }))
    .then((order) => {
      return Promise.all([
        addListNFTsIncentiveAction(repositories, profileUrl, chainId, order),
        dbUtils.getNFTsFromTxOrders([order]).then(seService.indexNFTs),
      ]).then(results => results[0])
    })
    .catch(err => appError.buildInvalid(
      txActivityError.buildX2Y2(err),
      txActivityError.ErrorType.X2Y2,
    ))
}

const updateENSNFTMetadata = async (
  _: any,
  args: gql.MutationUpdateEnsnftMetadataArgs,
  ctx: Context,
): Promise<gql.UploadMetadataImagesToS3Output> => {
  const { repositories, chain } = ctx
  const chainId = chain.id || process.env.CHAIN_ID
  auth.verifyAndGetNetworkChain('ethereum', chainId)
  logger.debug('updateENSNFTMetadata', { count: args?.count })
  try {
    const count = Math.min(Number(args?.count), 1000)
    const nfts = await repositories.nft.find({ where: { type: defs.NFTType.UNKNOWN, chainId } })
    const toUpdate = []
    for (let i = 0; i < nfts.length; i++) {
      if (!nfts[i].metadata.imageURL)
        toUpdate.push(nfts[i])
    }
    const slidedNFTs = toUpdate.slice(0, count)
    await Promise.allSettled(
      slidedNFTs.map(async (nft) => {
        await updateNFTMetadata(nft, repositories)
      }),
    )
    logger.debug('Update image urls of ENS NFTs', { counts: slidedNFTs.length })
    return {
      message: `Updated image urls of metadata for ${slidedNFTs.length} ENS NFTs`,
    }
  } catch (err) {
    Sentry.captureMessage(`Error in updateENSNFTMetadata: ${err}`)
    return err
  }
}

export default {
  Query: {
    gkNFTs: getGkNFTs,
    nft: getContractNFT,
    nftById: getNFT,
    myNFTs: combineResolvers(auth.isAuthenticated, getMyNFTs),
    curationNFTs: getCurationNFTs,
    collectionNFTs: getCollectionNFTs,
    nftsForCollections: getNFTsForCollections,
  },
  Mutation: {
    refreshMyNFTs: combineResolvers(auth.isAuthenticated, refreshMyNFTs),
    updateNFTsForProfile: updateNFTsForProfile,
    updateAssociatedAddresses: updateAssociatedAddresses,
    updateAssociatedContract: updateAssociatedContract,
    refreshNft,
    refreshNFTOrder: combineResolvers(auth.isAuthenticated, refreshNFTOrder),
    updateNFTMemo: combineResolvers(auth.isAuthenticated, updateNFTMemo),
    updateNFTProfileId: combineResolvers(auth.isAuthenticated, updateNFTProfileId),
    updateENSNFTMetadata: combineResolvers(auth.isAuthenticated, updateENSNFTMetadata),
    listNFTSeaport,
    listNFTLooksrare,
    listNFTX2Y2,
  },
  NFT: {
    collection: async (parent, args, ctx) => {
      if (parent.collection) {
        return parent.collection
      }
      return core.resolveCollectionById<gql.NFT, entity.Collection>(
        'contract',
        defs.EntityType.NFT,
      )(parent, args, ctx)
    },
    wallet: async (parent, _args, ctx) => {
      const { loaders: { wallet } } = ctx
      return parent.walletId ? wallet.load(parent.walletId) : null
    },
    isOwnedByMe: core.resolveEntityOwnership<gql.NFT>(
      'userId',
      'user',
      defs.EntityType.NFT,
    ),
    preferredProfile: core.resolveEntityById<gql.NFT, entity.Profile>(
      'profileId',
      defs.EntityType.NFT,
      defs.EntityType.Profile,
    ),
    isGKMinted: async (parent, _args, _ctx) => {
      return profileGKNFT(
        parent.contract,
        parent.tokenId,
        parent.chainId || process.env.CHAIN_ID,
      )
    },
    listings: async (parent, args, ctx) => {
      const { loaders: {
        listingsByNFT,
        listingsByNFTCancelled,
        listingsByNFTExecuted,
        listingsByNFTExpired,
        listingsByNFTExpiredAndCancelled,
        listingsByNFTExpiredAndExecuted,
      } } = ctx
      const expirationType: gql.ActivityExpiration = args?.['listingsExpirationType']
      const listingsStatus: defs.ActivityStatus = args?.['listingsStatus'] || defs.ActivityStatus.Valid
      if (expirationType === gql.ActivityExpiration.Expired) {
        if (listingsStatus === defs.ActivityStatus.Cancelled) {
          return listingsByNFTExpiredAndCancelled.load({ ...parent, args })
        } else if (listingsStatus === defs.ActivityStatus.Executed) {
          return listingsByNFTExpiredAndExecuted.load({ ...parent, args })
        }
        return listingsByNFTExpired.load({ ...parent, args })
      }
      if (listingsStatus === defs.ActivityStatus.Cancelled) {
        return listingsByNFTCancelled.load({ ...parent, args })
      } else if (listingsStatus === defs.ActivityStatus.Executed) {
        return listingsByNFTExecuted.load({ ...parent, args })
      }
      return listingsByNFT.load({ ...parent, args })
    },
    likeCount: async (parent) => {
      likeService.getLikeCount(parent.id)
    },
  },
}
