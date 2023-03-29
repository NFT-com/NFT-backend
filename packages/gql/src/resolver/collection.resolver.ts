import { ethers } from 'ethers'
import * as getStream from 'get-stream'
import { combineResolvers } from 'graphql-resolvers'
import type { FileUpload } from 'graphql-upload/processRequest.js'
import Joi from 'joi'
import { IsNull } from 'typeorm'
import { In } from 'typeorm/find-options/operator/In'

import { cache, CacheKeys } from '@nftcom/cache'
import { appError, collectionError } from '@nftcom/error-types'
import { Context, gql } from '@nftcom/gql/defs'
import { auth, joi, pagination } from '@nftcom/gql/helper'
import { core } from '@nftcom/gql/service'
import { getCollectionDeployer } from '@nftcom/gql/service/alchemy.service'
import { getCollectionInfo, getCollectionNameFromDataProvider } from '@nftcom/gql/service/nft.service'
import { SearchEngineService } from '@nftcom/gql/service/searchEngine.service'
import { _logger, contracts, db, defs, entity, helper, provider, typechain } from '@nftcom/shared'
import * as Sentry from '@sentry/node'

import { CollectionLeaderboardDateRange, DEFAULT_COLL_LB_DATE_RANGE, getSortedLeaderboard } from '../service/collection.service'
import { likeService } from '../service/like.service'

const logger = _logger.Factory(_logger.Context.Collection, _logger.Context.GraphQL)
const seService = SearchEngineService()

const MAX_SAVE_COUNTS = 500

const getCollection = async (
  _: any,
  args: gql.QueryCollectionArgs,
  ctx: Context,
): Promise<gql.CollectionInfo> => {
  try {
    logger.debug('getCollection', { input: args?.input })
    const chainId = args?.input?.chainId || process.env.CHAIN_ID
    auth.verifyAndGetNetworkChain('ethereum', chainId)
    return await getCollectionInfo(args?.input?.contract, chainId, ctx.repositories)
  } catch (err) {
    Sentry.captureMessage(`Error in getCollection: ${err}`)
    return err
  }
}

const getCollectionsByDeployer = async (
  _: any,
  args: gql.QueryCollectionsByDeployerArgs,
  ctx: Context,
): Promise<gql.Collection[]> => {
  logger.debug('getCollection', { input: args?.deployer })
  try {
    if (args?.deployer == null) {
      return []
    }
    return ctx.repositories.collection.find({
      where: { deployer: helper.checkSum(args?.deployer), isSpam: false },
    })
  } catch {
    Sentry.captureMessage('Error in getCollectionsByDeployer: invalid address')
    return []
  }
}

const getCollectionTraits = async (
  _: any,
  args: gql.QueryCollectionTraitsArgs,
  ctx: Context,
): Promise<gql.CollectionTraitsSummary> => {
  const schema = Joi.object().keys({
    contract: Joi.string().required(),
  })
  const { input } = args
  joi.validateSchema(schema, input)

  const rawTraitSummary = await ctx.repositories.nft.fetchTraitSummaryData(input.contract)
  const totalCount = rawTraitSummary.filter(t => rawTraitSummary[0].type === t.type)
    .reduce((sum, t) => { return sum + parseInt(t.count) }, 0)
  const traits = []
  for (const t of rawTraitSummary) {
    if (traits.length && traits[traits.length - 1].type === t.type) {
      traits[traits.length - 1].counts.push({
        count: t.count,
        value: t.value,
      })
    } else {
      traits.push({
        type: t.type,
        counts: [{
          count: t.count,
          value: t.value,
        }],
      })
    }
  }

  return {
    stats: {
      totalCount,
    },
    traits,
  }
}

const getOfficialCollections = async (
  _: unknown,
  args: gql.QueryOfficialCollectionsArgs,
  ctx: Context,
): Promise<gql.OfficialCollectionsOutput> => {
  const { repositories } = ctx
  const schema = Joi.object().keys({
    offsetPageInput: Joi.object().keys({
      page: Joi.number().optional(),
      pageSize: Joi.number().optional(),
    }).optional(),
  })
  const input = args.input || {}
  joi.validateSchema(schema, input)
  const defaultCacheDuration = 12 * 60 * 60 * 1000 // 12hrs in ms
  try {
    return await core.paginatedOffsetResultsFromEntitiesBy({
      repo: repositories.collection,
      offsetPageInput: args.input.offsetPageInput,
      filters: [{ isOfficial: true }],
      orderKey: 'id',
      orderDirection: 'DESC',
      select: {
        id: true,
        chainId: true,
        contract: true,
        name: true,
        updatedAt: true,
      },
      cache: defaultCacheDuration,
    },
    )
  } catch (err) {
    Sentry.captureException(err)
    Sentry.captureMessage(`Error in getOfficialCollections: ${err}`)
    logger.error(err, 'Error in getOfficialCollections')
    return err
  }
}

const removeCollectionDuplicates = async (
  _: any,
  args: gql.MutationRemoveDuplicatesArgs,
  ctx: Context,
): Promise<gql.RemoveDuplicatesOutput> => {
  const { repositories } = ctx
  logger.debug('removeCollectionDuplicates', { contracts: args?.contracts })
  try {
    const { contracts } = args
    let removedDuplicates = false
    await Promise.allSettled(
      contracts.map(async (contract) => {
        const collections = await repositories.collection.find({ where: { contract: contract } })
        if (collections.length > 1) {
          const toRemove = collections.slice(1, collections.length)
          await Promise.allSettled(
            toRemove.map(async (collection) => {
              const edgeVals = {
                thisEntityType: defs.EntityType.Collection,
                thatEntityType: defs.EntityType.NFT,
                thisEntityId: collection.id,
                edgeType: defs.EdgeType.Includes,
              }
              const edges = await repositories.edge.find({ where: edgeVals })
              if (edges.length) {
                const updatedEdges = []
                for (let i = 0; i < edges.length; i++) {
                  updatedEdges.push({
                    id: edges[i].id,
                    thisEntityId: collections[0].id,
                  })
                }
                await repositories.edge.saveMany(updatedEdges, { chunk: MAX_SAVE_COUNTS })
              }
            }),
          )

          if (toRemove.length) {
            const removeIds = toRemove.map((collection) => collection.id)
            await repositories.collection.hardDeleteByIds(removeIds)
            await seService.deleteCollections(toRemove)
            removedDuplicates = true
          }
        }
      }),
    )
    return removedDuplicates ? { message: 'Removed collection duplicates' } : { message: 'No duplicates found' }
  } catch (err) {
    Sentry.captureException(err)
    Sentry.captureMessage(`Error in removeCollectionDuplicates: ${err}`)
    return err
  }
}

const fetchAndSaveCollectionInfo = async (
  repositories: db.Repository,
  contract: string,
): Promise<void> => {
  try {
    const nfts = await repositories.nft.find({
      where: {
        contract: helper.checkSum(contract),
      },
    })
    if (nfts.length) {
      const collectionName = await getCollectionNameFromDataProvider(
        nfts[0].contract,
        nfts[0].chainId,
        nfts[0].type,
      )
      const collection = await repositories.collection.save({
        contract: helper.checkSum(contract),
        chainId: nfts[0]?.chainId || process.env.CHAIN_ID,
        name: collectionName,
      })
      await seService.indexCollections([collection])

      await Promise.allSettled(
        nfts.map(async (nft) => {
          const edgeVals = {
            thisEntityType: defs.EntityType.Collection,
            thatEntityType: defs.EntityType.NFT,
            thisEntityId: collection.id,
            thatEntityId: nft.id,
            edgeType: defs.EdgeType.Includes,
          }
          const edge = await repositories.edge.findOne({ where: edgeVals })
          if (!edge) await repositories.edge.save(edgeVals)
        }),
      )
    }
  } catch (err) {
    Sentry.captureException(err)
    Sentry.captureMessage(`Error in fetchAndSaveCollectionInfo: ${err}`)
    return err
  }
}

const syncCollectionsWithNFTs = async (
  _: any,
  args: gql.MutationSyncCollectionsWithNFTsArgs,
  ctx: Context,
): Promise<gql.SyncCollectionsWithNFTsOutput> => {
  const { repositories } = ctx
  logger.debug('syncCollectionsWithNFTs', { count: args?.count })
  try {
    const { count } = args
    const contracts = await repositories.nft.findDistinctContracts()
    const missingContracts = []
    await Promise.allSettled(
      contracts.map(async (contract) => {
        const collection = await repositories.collection.findOne({
          where: { contract: ethers.utils.getAddress(contract.nft_contract) },
        })
        if (!collection) missingContracts.push(contract.nft_contract)
      }),
    )
    const length = missingContracts.length > count ? count : missingContracts.length
    const toSaveContracts = missingContracts.slice(0, length)
    await Promise.allSettled(
      toSaveContracts.map(async (contract) => {
        await fetchAndSaveCollectionInfo(repositories, contract)
      }),
    )

    return {
      message: `Saved new ${length} collections`,
    }
  } catch (err) {
    Sentry.captureException(err)
    Sentry.captureMessage(`Error in syncCollectionsWithNFTs: ${err}`)
    return err
  }
}

const saveCollectionForContract = async (
  _: any,
  args: gql.MutationSaveCollectionForContractArgs,
  ctx: Context,
): Promise<gql.SaveCollectionForContractOutput> => {
  const { repositories } = ctx
  logger.debug('saveCollectionForContract', { contract: args?.contract })
  try {
    const { contract } = args
    const collection = await repositories.collection.findOne({
      where: {
        contract: helper.checkSum(contract),
      },
    })
    if (!collection) {
      await fetchAndSaveCollectionInfo(repositories, contract)
      return {
        message: 'Collection is saved.',
      }
    } else {
      return {
        message: 'Collection is already existing.',
      }
    }
  } catch (err) {
    Sentry.captureException(err)
    Sentry.captureMessage(`Error in saveCollectionForContract: ${err}`)
    return err
  }
}

/**
 * Retrieves the deployer address and associated addresses of an NFT collection on Ethereum.
 * 
 * @param _ Unused argument
 * @param args Query arguments
 * @param ctx Context object with repositories, chain, wallet, logger, and cache
 * 
 * @returns Promise that resolves to the deployer address, associated addresses, and deployerIsAssociated flag
 */
export const associatedAddressesForContract = async (
  _: any,
  args: gql.QueryAssociatedAddressesForContractArgs,
  ctx: Context,
): Promise<gql.AssociatedAddressesForContractOutput> => {
  try {
    const { repositories, chain, wallet } = ctx
    
    // Debug logging
    logger.debug('associatedAddressesForContract', { contract: args?.contract })

    // Verify and get network chain
    const chainId = chain.id || process.env.CHAIN_ID
    auth.verifyAndGetNetworkChain('ethereum', chainId)

    // Retrieve collection from database or blockchain
    const collection = await repositories.collection.findOne({ where: { contract: helper.checkSum(args?.contract) } })
    const collectionDeployer = collection?.deployer || await getCollectionDeployer(args?.contract, chainId)

    // Update collection deployer if defined
    if (collectionDeployer && !collection?.deployer) {
      await repositories.collection.updateOneById(collection.id, { deployer: collectionDeployer })
    }

    // Retrieve profiles for current wallet and chain
    const profiles = await repositories.profile.find({
      where: {
        ownerWalletId: wallet.id,
        chainId,
      },
    })
    
    // Retrieve associated addresses for each profile
    const addresses: string[] = []
    await Promise.allSettled(
      profiles.map(async (profile) => {
        const key = `associated_addresses_${profile.url}_${chainId}`
        const cachedData = await cache.get(key)
        let addrs
        if (cachedData) {
          addrs = JSON.parse(cachedData) as string[]
        } else {
          const nftResolverContract = typechain.NftResolver__factory.connect(
            contracts.nftResolverAddress(chainId),
            provider.provider(Number(chainId)),
          )
          const associatedAddresses = await nftResolverContract.associatedAddresses(profile.url)
          addrs = associatedAddresses.map((item) => item.chainAddr)
          await cache.set(key, JSON.stringify(addrs), 'EX', 60 * 10)
        }
        addresses.push(...addrs)
      }),
    )
    
    // Return deployer address, associated addresses, and deployerIsAssociated flag
    return {
      deployerAddress: collectionDeployer,
      associatedAddresses: addresses,
      deployerIsAssociated: collectionDeployer ?
        (addresses.indexOf(helper.checkSum(collectionDeployer)) !== -1 ||
          helper.checkSum(collectionDeployer) === wallet.address
        ) : false,
    }
  } catch (err) {
    Sentry.captureMessage(`Error in associatedAddressesForContract: ${err}`)
    return err
  }
}

const updateCollectionImageUrls = async (
  _: any,
  args: gql.MutationUpdateCollectionImageUrlsArgs,
  ctx: Context,
): Promise<gql.UpdateCollectionImageUrlsOutput> => {
  const { repositories, chain } = ctx
  logger.debug('updateCollectionImageUrls', { count: args?.count })
  const chainId = chain.id || process.env.CHAIN_ID
  auth.verifyAndGetNetworkChain('ethereum', chainId)
  try {
    const { count } = args
    const collections = await repositories.collection.find({
      where: {
        chainId,
        bannerUrl: IsNull(),
        logoUrl: IsNull(),
      },
    })
    const length = collections.length > count ? count : collections.length
    const toUpdate = collections.slice(0, length)
    await Promise.allSettled(
      toUpdate.map(async (collection) => {
        try {
          await getCollectionInfo(collection.contract, chainId, repositories)
        } catch (err) {
          logger.error(`Error in updateCollectionImageUrls: ${err}`)
          Sentry.captureMessage(`Error in updateCollectionImageUrls: ${err}`)
        }
      }),
    )

    return {
      message: `Updated ${length} collections`,
    }
  } catch (err) {
    Sentry.captureException(err)
    Sentry.captureMessage(`Error in updateCollectionImageUrls: ${err}`)
    return err
  }
}

const updateCollectionName = async (
  _: any,
  args: gql.MutationUpdateCollectionNameArgs,
  ctx: Context,
): Promise<gql.UpdateCollectionNameOutput> => {
  const { repositories, chain } = ctx
  logger.debug('updateCollectionName', { count: args?.count })
  const chainId = chain.id || process.env.CHAIN_ID
  auth.verifyAndGetNetworkChain('ethereum', chainId)
  try {
    const { count } = args
    const collections = await repositories.collection.find({
      where: {
        chainId,
        name: 'Unknown Name',
      },
    })
    const length = Math.min(collections.length, count)
    const toUpdate = collections.slice(0, length)
    await Promise.allSettled(
      toUpdate.map(async (collection) => {
        const nft = await repositories.nft.findOne({
          where: {
            contract: helper.checkSum(collection.contract),
            chainId,
          },
        })
        const name = await getCollectionNameFromDataProvider(collection.contract, chainId, nft.type)
        if (name !== 'Unknown Name') {
          await repositories.collection.updateOneById(collection.id, { name })
        } else {
          // If NFT is ENS token,we change collection name to ENS
          if (nft?.metadata?.name?.endsWith('.eth')) {
            await repositories.collection.updateOneById(collection.id, { name: 'ENS: Ethereum Name Service' })
          }
        }
      }),
    )

    return {
      message: `Updated ${length} collections`,
    }
  } catch (err) {
    Sentry.captureException(err)
    Sentry.captureMessage(`Error in updateCollectionImageUrls: ${err}`)
    return err
  }
}

const updateSpamStatus = async (
  _: any,
  args: gql.MutationUpdateSpamStatusArgs,
  ctx: Context,
): Promise<gql.UpdateSpamStatusOutput> => {
  const { repositories, chain } = ctx
  logger.debug('updateSpamStatus', { contracts: args?.contracts, isSpam: args?.isSpam })
  const chainId = chain.id || process.env.CHAIN_ID
  auth.verifyAndGetNetworkChain('ethereum', chainId)
  try {
    const { contracts, isSpam } = args
    const toUpdate: entity.Collection[] = []
    await Promise.allSettled(
      contracts.map(async (contract) => {
        const collection = await repositories.collection.findOne({
          where: {
            contract: helper.checkSum(contract),
            chainId,
          },
        })
        if (collection && collection.isSpam !== isSpam) {
          collection.isSpam = isSpam
          toUpdate.push(collection)
        }
      }),
    )
    if (toUpdate.length) {
      await repositories.collection.saveMany(toUpdate, { chunk: MAX_SAVE_COUNTS })
      if (isSpam) {
        seService.deleteCollections(toUpdate)
        await Promise.all((await repositories.nft.find({
          where: {
            contract: In(toUpdate.map(coll => coll.contract)),
          },
        })).map(async (nft) => {
          await seService.deleteNFT(nft.id)
        }))
      } else {
        seService.indexCollections(toUpdate)
        seService.indexNFTs(await repositories.nft.find({
          where: {
            contract: In(toUpdate.map(coll => coll.contract)),
          },
        }))
      }
    }
    return {
      message: isSpam ? `${toUpdate.length} collections are set as spam`
        : `${toUpdate.length} collections are set as not spam`,
    }
  } catch (err) {
    Sentry.captureException(err)
    Sentry.captureMessage(`Error in updateSpamStatus: ${err}`)
    return err
  }
}

const getNumberOfNFTs = async (
  _: any,
  args: gql.QueryNumberOfNFTsArgs,
  ctx: Context,
): Promise<number> => {
  try {
    const { repositories } = ctx
    logger.debug('getNumberOfNFTs', { contract: args?.contract, chainId: args?.chainId })
    const chainId = args?.chainId || process.env.CHAIN_ID
    auth.verifyAndGetNetworkChain('ethereum', chainId)
    const key = `nft_amount_${args?.contract}_${chainId}`
    const cachedData = await cache.get(key)
    if (cachedData) {
      return JSON.parse(cachedData)
    }
    const collection = await repositories.collection.findOne({
      where: {
        contract: helper.checkSum(args?.contract),
        chainId,
      },
    })
    if (!collection) return 0
    const count = await repositories.nft.count({
      contract: helper.checkSum(args?.contract),
      chainId,
    })
    await cache.set(key, count.toString(), 'EX', 60 * 5)
    return count
  } catch (err) {
    Sentry.captureMessage(`Error in getNumberOfNFTs: ${err}`)
    return err
  }
}

const updateOfficialCollections = async (
  _: any,
  args: gql.MutationUpdateOfficialCollectionsArgs,
  ctx: Context,
): Promise<gql.UpdateOfficialCollectionsOutput> => {
  const { repositories, chain } = ctx
  const chainId = chain.id || process.env.CHAIN_ID
  auth.verifyAndGetNetworkChain('ethereum', chainId)
  try {
    const list = args?.list
    let listResponse
    let listStream: FileUpload['createReadStream']
    if (list) {
      // we read collection list as FileUpload createReadStream
      listResponse = await list
      listStream = listResponse.createReadStream()
      // convert createReadStream to string
      const result = await getStream.default(listStream)
      // parse contracts array from string
      const contracts = result.split(/\r?\n/)
      if (contracts.length) {
        const updatedList = []
        await Promise.allSettled(
          contracts.map(async (contract) => {
            try {
              const collection = await repositories.collection.findByContractAddress(
                helper.checkSum(contract),
                chainId,
              )
              if (collection && !collection?.isOfficial) {
                const updated = await repositories.collection.updateOneById(collection.id, { isOfficial: true })
                updatedList.push(updated)
              }
            } catch (err) {
              logger.error(`Error in updateOfficialCollections ${err}`)
            }
          }),
        )
        return { message: `${updatedList.length} collections are updated as official` }
      } else {
        return { message: 'Something is wrong with your CSV file' }
      }
    }
  } catch (err) {
    Sentry.captureMessage(`Error in updateOfficialCollections: ${err}`)
    return err
  }
}

const getCollectionLeaderboard = async (
  _: any,
  args: gql.QueryCollectionLeaderboardArgs,
  ctx: Context,
): Promise<gql.CollectionLeaderboard> => {
  const schema = Joi.object().keys({
    dateRange: Joi.string().valid('24h', '7d', '30d', 'all').optional(),
    pageInput: Joi.any().optional(),
  })
  const input = args.input || {}
  joi.validateSchema(schema, input)
  const { pageInput, dateRange: dateRangeInput } = input
  const { repositories } = ctx

  const dateRange = dateRangeInput as CollectionLeaderboardDateRange || DEFAULT_COLL_LB_DATE_RANGE
  const defaultNumItems = 10
  const cacheKey = `COLLECTION_LEADERBOARD_HYDRATED_${dateRange}`
  const cachedLeaderboard = await cache.get(cacheKey)
  const leaderboard = cachedLeaderboard ?
    JSON.parse(cachedLeaderboard) :
    await getSortedLeaderboard(repositories.collection, { dateRange })
  if (!cachedLeaderboard && leaderboard.length) {
    await cache.set(cacheKey, JSON.stringify(leaderboard), 'EX', 60 * 60)
  }

  const defaultCursor = pageInput && pagination.hasLast(pageInput) ?
    { beforeCursor: (pageInput && pageInput.beforeCursor) || '-1' } :
    { afterCursor: (pageInput && pageInput.afterCursor) || '-1' }
  const safePageInput = pagination.safeInput(pageInput, defaultCursor, defaultNumItems)
  const [paginatedLeaderboard, leaderboardLength] = await core.paginateEntityArray(leaderboard, safePageInput)

  return pagination.toPageable(
    safePageInput,
    paginatedLeaderboard[0],
    paginatedLeaderboard[paginatedLeaderboard.length - 1],
    'id',
  )([paginatedLeaderboard, leaderboardLength])
}

export const refreshCollectionRarity = async (_: any,
  args: gql.MutationRefreshNFTOrderArgs,
  ctx: Context): Promise<string> => {
  const { repositories, chain } = ctx
  logger.debug('refreshCollectionRarity', { id: args?.id })
  const schema = Joi.object().keys({
    id: Joi.string().required(),
    force: Joi.boolean().optional(),
    ttl: Joi.date().optional(),
  })
  joi.validateSchema(schema, args)
  try {
    const collection = await repositories.collection.findById(args?.id)
    if (!collection) {
      return Promise.reject(appError.buildNotFound(
        collectionError.buildCollectionNotFoundMsg('NFT: ' + args?.id),
        collectionError.ErrorType.CollectionNotFound,
      ))
    }

    const recentlyRefreshed: string = await cache.zscore(`${CacheKeys.REFRESHED_COLLECTION_RARITY}_${chain.id}`, `${collection.contract}`)
    if (!args.force && recentlyRefreshed) {
      return 'Refreshed Recently! Try in sometime!'
    }

    let collectionCacheId: string = collection.contract

    if (args?.force) {
      collectionCacheId += ':force'
    } else {
      if (args?.ttl === null) {
        collectionCacheId += ':manual'
      }

      if (args?.ttl) {
        const ttlDate: Date = new Date(args?.ttl)
        const now: Date = new Date()
        if (ttlDate && ttlDate > now) {
          collectionCacheId += `:${ttlDate.getTime()}`
        }
      }
    }
    // add to cache list
    await cache.zadd(`${CacheKeys.REFRESH_COLLECTION_RARITY}_${chain.id}`, 'INCR', 1, collectionCacheId)
    return 'Added to queue! Check back shortly!'
  } catch (err) {
    Sentry.captureMessage(`Error in refreshCollectionRarity: ${err}`)
    return err
  }
}

export default {
  Query: {
    collection: getCollection,
    collectionsByDeployer: getCollectionsByDeployer,
    collectionLeaderboard: getCollectionLeaderboard,
    collectionTraits: getCollectionTraits,
    officialCollections: combineResolvers(auth.isTeamKeyAuthenticated, getOfficialCollections),
    associatedAddressesForContract:
      combineResolvers(auth.isAuthenticated, associatedAddressesForContract),
    numberOfNFTs: getNumberOfNFTs,
  },
  Mutation: {
    removeDuplicates: combineResolvers(auth.isAuthenticated, removeCollectionDuplicates),
    refreshCollectionRarity: combineResolvers(auth.isAuthenticated, refreshCollectionRarity),
    saveCollectionForContract: combineResolvers(auth.isAuthenticated, saveCollectionForContract),
    syncCollectionsWithNFTs: combineResolvers(auth.isAuthenticated, syncCollectionsWithNFTs),
    updateCollectionImageUrls: combineResolvers(auth.isAuthenticated, updateCollectionImageUrls),
    updateCollectionName: combineResolvers(auth.isAuthenticated, updateCollectionName),
    updateSpamStatus: combineResolvers(auth.isTeamAuthenticated, updateSpamStatus),
    updateOfficialCollections: combineResolvers(auth.isAuthenticated, updateOfficialCollections),
  },
  Collection: {
    likeCount: async (parent) => {
      if (!parent) {
        return 0
      }
      return likeService.getLikeCount(parent.id)
    },
    isLikedByUser: async (parent, _, ctx) => {
      if (!parent || !ctx.user) {
        return false
      }
      return likeService.isLikedByUser(parent.id, ctx.user.id)
    },
  },
}
