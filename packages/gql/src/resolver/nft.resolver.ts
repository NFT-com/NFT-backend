import { ethers, utils } from 'ethers'
import { combineResolvers } from 'graphql-resolvers'
import Joi from 'joi'
import { FindOneOptions, In } from 'typeorm'

import { createAlchemyWeb3 } from '@alch/alchemy-web3'
import { appError, curationError, nftError, profileError, txActivityError } from '@nftcom/error-types'
import { Context, gql, Pageable } from '@nftcom/gql/defs'
import { auth, joi, pagination } from '@nftcom/gql/helper'
import { core } from '@nftcom/gql/service'
import {
  _logger,
  contracts, db,
  defs,
  entity,
  fp,
  helper,
} from '@nftcom/shared'

const logger = _logger.Factory(_logger.Context.NFT, _logger.Context.GraphQL)

import { differenceInMilliseconds } from 'date-fns'
import { Maybe } from 'graphql/jsutils/Maybe'

import { cache, CacheKeys } from '@nftcom/cache'
import { PageInput } from '@nftcom/gql/defs/gql'
import { stringifyTraits } from '@nftcom/gql/service/core.service'
import { createLooksrareListing } from '@nftcom/gql/service/looksare.service'
import {
  checkNFTContractAddresses,
  getNFTActivities,
  getUserWalletFromNFT,
  initiateWeb3, queryNFTsForProfile,
  saveNewNFT, updateCollectionForAssociatedContract,
  updateNFTMetadata, updateNFTOwnershipAndMetadata, updateNFTsForAssociatedAddresses,
  updateWalletNFTs,
} from '@nftcom/gql/service/nft.service'
import { createSeaportListing } from '@nftcom/gql/service/opensea.service'
import { SearchEngineService } from '@nftcom/gql/service/searchEngine.service'
import { triggerNFTOrderRefreshQueue } from '@nftcom/gql/service/txActivity.service'
import { createX2Y2Listing } from '@nftcom/gql/service/x2y2.service'
import * as Sentry from '@sentry/node'

// const PROFILE_NFTS_EXPIRE_DURATION = Number(process.env.PROFILE_NFTS_EXPIRE_DURATION)
// const PROFILE_SCORE_EXPIRE_DURATION = Number(process.env.PROFILE_SCORE_EXPIRE_DURATION)
const REFRESH_NFT_DURATION = Number(process.env.REFRESH_NFT_DURATION)

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

const seService = new SearchEngineService()

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
      const now = helper.toUTCDate()
      let duration
      if (nft.lastRefreshed) {
        duration = differenceInMilliseconds(now, nft.lastRefreshed)
      }
      if (!nft.lastRefreshed  ||
        (duration && duration > REFRESH_NFT_DURATION)
      ) {
        repositories.nft.updateOneById(nft.id, { lastRefreshed: now })
          .then((Nft) => {
            const obj = {
              contract: {
                address: Nft.contract,
              },
              id: {
                tokenId: Nft.tokenId,
              },
            }
            getUserWalletFromNFT(Nft.contract, Nft.tokenId, chainId)
              .then((wallet) => {
                if (!wallet) {
                  logger.error('Failed to create new user and wallet for NFT ownership')
                } else {
                  updateNFTOwnershipAndMetadata(
                    obj,
                    wallet.userId,
                    wallet.id,
                    chainId,
                  ).then(() => {
                    logger.info(`Updated NFT ownership and metadata for contract ${Nft.contract} and tokenId ${Nft.tokenId}`)
                  })
                }
              })
          })
      }
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

const getNFTs = (
  _: unknown,
  args: gql.QueryNFTsArgs,
  ctx: Context,
): Promise<gql.CurationNFTsOutput> => {
  const { user, repositories } = ctx
  logger.debug('getNFTs', { loggedInUserId: user?.id, input: args?.input })
  const { types, profileId } = helper.safeObject(args?.input)
  const chainId = args?.input.chainId || process.env.CHAIN_ID
  auth.verifyAndGetNetworkChain('ethereum', chainId)
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
      return repositories.profile.findOne({
        where: { id: profileId, chainId: chainId },
      })
        .then((profile: entity.Profile) =>
          repositories.nft.findByWalletId(profile.ownerWalletId, chainId)
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
          repositories.nft.findOne({ where: { id: item.id, ...filter } } as FindOneOptions<entity.NFT>))),
      ]).then(([items, nfts]) => nfts
        .filter((nft) => nft !== null)
        .map((nft, index) => ({ nft: nft, size: items[index].size })))
        .then((nfts) => Promise.resolve({
          items: nfts,
        }))
    }
  })
}

const returnProfileNFTs = async (
  profileId: string,
  ctx: Context,
  pageInput: PageInput,
  chainId: string,
  repositories: db.Repository,
  query: string,
): Promise<any> => {
  try {
    let filter: Partial<entity.Edge> = helper.removeEmpty({
      thisEntityType: defs.EntityType.Profile,
      thisEntityId: profileId,
      thatEntityType: defs.EntityType.NFT,
      edgeType: defs.EdgeType.Displays,
    })
    const profile = await repositories.profile.findById(profileId)
    if (query && query?.length) {
      const cacheKey = `${CacheKeys.SEARCH_NFTS_FOR_PROFILE}_${chainId}_${profile.url}_${query}`
      const cachedData = await cache.get(cacheKey)
      let nfts: entity.NFT[]
      if (cachedData) {
        nfts = JSON.parse(cachedData) as entity.NFT[]
      } else {
        nfts = await queryNFTsForProfile(repositories, profile, false, query)
        await cache.set(cacheKey, JSON.stringify(nfts), 'EX', 10 * 60)
      }
      if (!nfts.length) return Promise.resolve({ items: [] })
      const nftIds = nfts.map((nft) => nft.id)
      filter = helper.removeEmpty({
        thisEntityType: defs.EntityType.Profile,
        thisEntityId: profile.id,
        thatEntityType: defs.EntityType.NFT,
        thatEntityId: In(nftIds),
        edgeType: defs.EdgeType.Displays,
      })
    }
    return core.paginatedThatEntitiesOfEdgesBy(
      ctx,
      ctx.repositories.nft,
      filter,
      pageInput,
      'weight',
      'ASC',
      chainId,
      'NFT',
    )
      .then((result) => {
        if (result?.items.length) {
          // refresh order queue trigger
          return Promise.resolve(triggerNFTOrderRefreshQueue(result?.items, chainId))
            .then(() => Promise.resolve(result))
        }
      })
  } catch (err) {
    logger.error(`Error in returnProfileNFTs: ${err}`)
    Sentry.captureMessage(`Error in returnProfileNFTs: ${err}`)
    throw err
  }
}

const getMyNFTs = async (
  _: unknown,
  args: gql.QueryNFTsArgs,
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
  })
  const { input } = args
  joi.validateSchema(schema, input)

  try {
    const filters: Partial<entity.NFT> = {
      walletId: wallet.id,
      userId: user.id ,
      chainId,
    }

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
      return await returnProfileNFTs(args?.input.profileId, ctx, pageInput, chainId, repositories, args?.input.query)
    } else if (!args?.input?.ownedByWallet && args?.input?.profileId) {
      const profile = await ctx.repositories.profile.findById(args?.input?.profileId)
      if (!profile) {
        return Promise.reject(appError.buildNotFound(
          profileError.buildProfileNotFoundMsg(args?.input?.profileId),
          profileError.ErrorType.ProfileNotFound,
        ))
      }
      return await returnProfileNFTs(args?.input.profileId, ctx, pageInput, chainId, repositories, args?.input.query)
    } else if (args?.input?.ownedByWallet && !args?.input?.profileId ) {
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
        })
    } else {
      const defaultProfile = await repositories.profile.findOne({
        where: {
          ownerUserId: user.id,
          ownerWalletId: wallet.id,
          chainId,
        },
      })
      if (!defaultProfile) {
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
          })
      } else {
        return await returnProfileNFTs(defaultProfile.id, ctx, pageInput, chainId, repositories, args?.input.query)
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
              updateWalletNFTs(user.id, wallet.id, wallet.address, wallet.chainId)
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
    const ALCHEMY_API_URL = chainId === '1' ? process.env.ALCHEMY_API_URL : process.env.ALCHEMY_API_URL_GOERLI
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
      userId: profile.ownerUserId,
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
  if (profile.ownerUserId && profile.description && profile.photoURL) {
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
          userId: profile.ownerUserId,
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

    const recentlyRefreshed: string = await cache.zscore(`${CacheKeys.UPDATED_NFTS_PROFILE}_${chainId}`, profile.id)
    if (!recentlyRefreshed) {
      // add to NFT cache list
      await cache.zadd(`${CacheKeys.UPDATE_NFTS_PROFILE}_${chainId}`, 'INCR', 1, profile.id)
    }

    let filter: Partial<entity.Edge> = helper.removeEmpty({
      thisEntityType: defs.EntityType.Profile,
      thisEntityId: profile.id,
      thatEntityType: defs.EntityType.NFT,
      edgeType: defs.EdgeType.Displays,
    })
    if (args?.input.query && args?.input.query?.length) {
      const cacheKey = `${CacheKeys.SEARCH_VISIBLE_NFTS_FOR_PROFILE}_${chainId}_${profile.url}_${args?.input.query}`
      const cachedData = await cache.get(cacheKey)
      let nfts: entity.NFT[]
      if (cachedData) {
        nfts = JSON.parse(cachedData) as entity.NFT[]
      } else {
        nfts = await queryNFTsForProfile(repositories, profile, true, args?.input.query)
        await cache.set(cacheKey, JSON.stringify(nfts), 'EX', 10 * 60)
      }
      if (!nfts.length) return Promise.resolve({ items: [] })
      const nftIds = nfts.map((nft) => nft.id)
      filter = helper.removeEmpty({
        thisEntityType: defs.EntityType.Profile,
        thisEntityId: profile.id,
        thatEntityType: defs.EntityType.NFT,
        thatEntityId: In(nftIds),
        edgeType: defs.EdgeType.Displays,
      })
    }

    return core.paginatedThatEntitiesOfEdgesBy(
      ctx,
      repositories.nft,
      { ...filter, hide: false },
      pageInput,
      'weight',
      'ASC',
      chainId,
      'NFT',
    ).then(result => {
      // refresh order queue trigger
      return Promise.resolve(triggerNFTOrderRefreshQueue(result?.items, chainId))
        .then(() => Promise.resolve(result))
    })
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

    const cacheKey = `${CacheKeys.REFRESH_NFT}_${chainId}_${args?.id}`
    const cachedData = await cache.get(cacheKey)
    if (cachedData) {
      return JSON.parse(cachedData)
    } else {
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
        if (!wallet) {
          logger.error('Failed to create new user and wallet for NFT ownership')
          return nft
        } else {
          const refreshedNFT = await updateNFTOwnershipAndMetadata(obj, wallet.userId, wallet.id, chainId)
          await seService.indexNFTs([refreshedNFT])

          await cache.set(
            cacheKey,
            JSON.stringify(refreshedNFT),
            'EX',
            5 * 60, // 5 minutes
          )
          return refreshedNFT
        }
      } else {
        return Promise.reject(appError.buildNotFound(
          nftError.buildNFTNotFoundMsg('NFT: ' + args?.id),
          nftError.ErrorType.NFTNotFound,
        ))
      }
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
            userId: profile.ownerUserId,
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
  const createdInternally = args?.input.createdInternally ? args?.input.createdInternally : false

  logger.debug('listNFTSeaport', { input: args?.input, wallet: ctx?.wallet?.id })

  return createSeaportListing(seaportSignature, seaportParams, chainId, createdInternally)
    .then(fp.thruIfNotEmpty((order: entity.TxOrder) => {
      return repositories.txOrder.save(order)
    }))
    .then(order => addListNFTsIncentiveAction(repositories, profileUrl, chainId, order))
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
  const createdInternally = args?.input.createdInternally ? args?.input.createdInternally : false

  logger.debug('listNFTLooksrare', { input: args?.input, wallet: ctx?.wallet?.id })

  return createLooksrareListing(looksrareOrder, chainId, createdInternally)
    .then(fp.thruIfNotEmpty((order: entity.TxOrder) => {
      return repositories.txOrder.save(order)
    }))
    .then(order => addListNFTsIncentiveAction(repositories, profileUrl, chainId, order))
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
  const chainId = args?.input?.chainId || process.env.CHAIN_ID
  const x2y2Order = args?.input?.x2y2Order
  const profileUrl = args?.input?.profileUrl

  logger.debug({ input: args?.input, wallet: ctx?.wallet?.id }, 'listNFTX2Y2')

  return createX2Y2Listing(x2y2Order, chainId)
    .then(fp.thruIfNotEmpty((order: entity.TxOrder) => {
      return repositories.txOrder.save(order)
    }))
    .then(order => addListNFTsIncentiveAction(repositories, profileUrl, chainId, order))
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
    nfts: getNFTs,
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
    collection: core.resolveCollectionById<gql.NFT, entity.Collection>(
      'contract',
      defs.EntityType.NFT,
    ),
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
    preferredProfile: core.resolveEntityById<gql.NFT, entity.Profile>(
      'profileId',
      defs.EntityType.NFT,
      defs.EntityType.Profile,
    ),
    listings: getNFTActivities(
      defs.ActivityType.Listing,
    ),
  },
}
