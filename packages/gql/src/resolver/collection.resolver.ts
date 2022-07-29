import delay from 'delay'
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
        collection.deployer = collectionDeployer
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
  }
}

const getCollectionsByDeployer = async (
  _: any,
  args: gql.QueryCollectionsByDeployerArgs,
  ctx: Context,
): Promise<gql.Collection[]> => {
  logger.debug('getCollection', { input: args?.deployer })
  return ctx.repositories.collection.find({ where: { deployer: args?.deployer } })
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
  }
}

const fillChainIds = async (
  _: any,
  args: gql.MutationFillChainIdsArgs,
  ctx: Context,
): Promise<gql.FillChainIdsOutput> => {
  const { repositories } = ctx
  logger.debug('fillChainIds', { input: args?.input })
  try {
    const chainId = args?.input.chainId || process.env.CHAIN_ID
    auth.verifyAndGetNetworkChain('ethereum', chainId)
    const entity = args?.input.entity
    if (entity === 'bid') {
      const bids = await repositories.bid.findAll()
      for (let i = 0; i < bids.length; i++) {
        if (!bids[i].chainId)
          bids[i].chainId = chainId
      }
      await repositories.bid.saveMany(bids, { chunk: MAX_SAVE_COUNTS })
    } else if (entity === 'collection') {
      const collections = await repositories.collection.findAll()
      for (let i = 0; i < collections.length; i++) {
        if (!collections[i].chainId)
          collections[i].chainId = chainId
      }
      await repositories.collection.saveMany(collections, { chunk: MAX_SAVE_COUNTS })
    } else if (entity === 'nft') {
      const nfts = await repositories.nft.findAll()
      for (let i = 0; i < nfts.length; i++) {
        if (!nfts[i].chainId)
          nfts[i].chainId = chainId
      }
      await repositories.nft.saveMany(nfts, { chunk: MAX_SAVE_COUNTS })
    } else if (entity === 'profile') {
      const profiles = await repositories.profile.findAll()
      for (let i = 0; i < profiles.length; i++) {
        if (!profiles[i].chainId) {
          profiles[i].chainId = chainId
          await repositories.profile.save(profiles[i])
          await delay(100)
        }
      }
    } else if (entity === 'txActivity') {
      const txActivities = await repositories.txActivity.findAll()
      for (let i = 0; i < txActivities.length; i++) {
        if (!txActivities[i].chainId)
          txActivities[i].chainId = chainId
      }
      await repositories.txActivity.saveMany(txActivities, { chunk: MAX_SAVE_COUNTS })
    } else if (entity === 'txBid') {
      const txBids = await repositories.txBid.findAll()
      for (let i = 0; i < txBids.length; i++) {
        if (!txBids[i].chainId)
          txBids[i].chainId = chainId
      }
      await repositories.txBid.saveMany(txBids, { chunk: MAX_SAVE_COUNTS })
    } else if (entity === 'txCancel') {
      const txCancels = await repositories.txCancel.findAll()
      for (let i = 0; i < txCancels.length; i++) {
        if (!txCancels[i].chainId)
          txCancels[i].chainId = chainId
      }
      await repositories.txCancel.saveMany(txCancels, { chunk: MAX_SAVE_COUNTS })
    } else if (entity === 'txList') {
      const txLists = await repositories.txList.findAll()
      for (let i = 0; i < txLists.length; i++) {
        if (!txLists[i].chainId)
          txLists[i].chainId = chainId
      }
      await repositories.txList.saveMany(txLists, { chunk: MAX_SAVE_COUNTS })
    } else if (entity === 'txSale') {
      const txSales = await repositories.txSale.findAll()
      for (let i = 0; i < txSales.length; i++) {
        if (!txSales[i].chainId)
          txSales[i].chainId = chainId
      }
      await repositories.txSale.saveMany(txSales, { chunk: MAX_SAVE_COUNTS })
    } else if (entity === 'txTransfer') {
      const txTransfers = await repositories.txTransfer.findAll()
      for (let i = 0; i < txTransfers.length; i++) {
        if (!txTransfers[i].chainId)
          txTransfers[i].chainId = chainId
      }
      await repositories.txTransfer.saveMany(txTransfers, { chunk: MAX_SAVE_COUNTS })
    }

    return {
      message: 'Filled chainId successfully.',
    }
  } catch (err) {
    Sentry.captureException(err)
    Sentry.captureMessage(`Error in fillChainIds: ${err}`)
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
    fillChainIds: combineResolvers(auth.isAuthenticated, fillChainIds),
  },
}
