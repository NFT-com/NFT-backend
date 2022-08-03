import { ethers } from 'ethers'
import { combineResolvers } from 'graphql-resolvers'

import { Context, gql } from '@nftcom/gql/defs'
import { auth } from '@nftcom/gql/helper'
import { getCollectionDeployer } from '@nftcom/gql/service/alchemy.service'
import { cache } from '@nftcom/gql/service/cache.service'
import { getCollectionNameFromContract } from '@nftcom/gql/service/nft.service'
import {
  retrieveCollectionOpensea,
  retrieveCollectionStatsOpensea,
} from '@nftcom/gql/service/opensea.service'
import { _logger, db,defs } from '@nftcom/shared'
import * as Sentry from '@sentry/node'

const logger = _logger.Factory(_logger.Context.Collection, _logger.Context.GraphQL)

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
    const key = `${args?.input?.contract?.toLowerCase()}-${chainId}-${args?.input?.withOpensea}`
    const cachedData = await cache.get(key)

    if (cachedData) {
      return JSON.parse(cachedData)
    } else {
      let stats, data

      if (args?.input?.withOpensea) {
        const slugKey = `${key}-slug`
        const cachedData = JSON.parse(await cache.get(slugKey))

        if (cachedData?.collection?.slug) {
          data = cachedData
          stats = await retrieveCollectionStatsOpensea(
            cachedData?.collection?.slug,
            chainId,
          )
        } else {
          data = await retrieveCollectionOpensea(args?.input?.contract, chainId)

          if (data) {
            if (data?.collection?.slug) {
              stats = await retrieveCollectionStatsOpensea(
                data?.collection?.slug,
                args?.input?.chainId,
              )
            }
          }

          await cache.set(slugKey, JSON.stringify(data), 'EX', 60 * 5) // set cache
        }
      }

      const collection = await ctx.repositories.collection.findByContractAddress(
        args?.input?.contract,
        chainId,
      )

      if (collection && collection.deployer == null) {
        const collectionDeployer = await getCollectionDeployer(args?.input?.contract, chainId)
        await ctx.repositories.collection.save({
          ...collection,
          deployer: collectionDeployer,
        })
        try {
          collection.deployer = ethers.utils.getAddress(collectionDeployer)
        } catch {
          collection.deployer = null
        }
      }

      const returnObject = {
        collection,
        openseaInfo: data,
        openseaStats: stats,
      }

      await cache.set(key, JSON.stringify(returnObject), 'EX', 60 * (args?.input?.withOpensea ? 30 : 5))

      return returnObject
    }
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
      where: { deployer: ethers.utils.getAddress(args?.deployer) },
    })
  } catch {
    Sentry.captureMessage('Error in getCollectionsByDeployer: invalid address')
    return []
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
          const removeIds = toRemove.map((collection) => collection.id)
          await repositories.collection.hardDeleteByIds(removeIds)
          removedDuplicates = true
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
    const nfts = await repositories.nft.find({ where: {
      contract: ethers.utils.getAddress(contract),
    } })
    if (nfts.length) {
      const collectionName = await getCollectionNameFromContract(
        nfts[0].contract,
        nfts[0].chainId,
        nfts[0].type,
      )
      const collection = await repositories.collection.save({
        contract: ethers.utils.getAddress(contract),
        chainId: nfts[0]?.chainId || process.env.CHAIN_ID,
        name: collectionName,
      })

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

const saveCollectionForContract = async (
  _: any,
  args: gql.MutationSaveCollectionForContractArgs,
  ctx: Context,
): Promise<gql.SaveCollectionForContractOutput> => {
  const { repositories } = ctx
  logger.debug('saveCollectionForContract', { contract: args?.contract })
  try {
    const { contract } = args
    const collection = await repositories.collection.findOne({ where: {
      contract: ethers.utils.getAddress(contract),
    } })
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

export default {
  Query: {
    collection: getCollection,
    collectionsByDeployer: getCollectionsByDeployer,
  },
  Mutation: {
    removeDuplicates: combineResolvers(auth.isAuthenticated, removeCollectionDuplicates),
    saveCollectionForContract: combineResolvers(auth.isAuthenticated, saveCollectionForContract),
    syncCollectionsWithNFTs: combineResolvers(auth.isAuthenticated, syncCollectionsWithNFTs),
  },
}
