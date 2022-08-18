import { ethers } from 'ethers'
import { combineResolvers } from 'graphql-resolvers'

import { Context, gql } from '@nftcom/gql/defs'
import { auth } from '@nftcom/gql/helper'
import { getCollectionDeployer } from '@nftcom/gql/service/alchemy.service'
import { cache } from '@nftcom/gql/service/cache.service'
import { contentTypeFromExt, extensionFromFilename } from '@nftcom/gql/service/core.service'
import { getCollectionInfo, getCollectionNameFromContract } from '@nftcom/gql/service/nft.service'
import { _logger, contracts, db, defs, entity,provider, typechain } from '@nftcom/shared'
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

export const associatedAddressesForContract = async (
  _: any,
  args: gql.QueryAssociatedAddressesForContractArgs,
  ctx: Context,
): Promise<gql.AssociatedAddressesForContractOutput> => {
  try {
    const { repositories, chain, wallet } = ctx
    logger.debug('associatedAddressesForContract', { contract: args?.contract })
    const chainId = chain.id || process.env.CHAIN_ID
    auth.verifyAndGetNetworkChain('ethereum', chainId)
    const collectionDeployer = await getCollectionDeployer(args?.contract, chainId)
    const profiles = await repositories.profile.find({
      where: {
        ownerWalletId: wallet.id,
        chainId,
      },
    })
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
    return {
      deployerAddress: collectionDeployer,
      associatedAddresses: addresses,
      deployerIsAssociated: collectionDeployer ?
        (addresses.indexOf(ethers.utils.getAddress(collectionDeployer)) !== -1 ||
          ethers.utils.getAddress(collectionDeployer) === wallet.address
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
    const collections = await repositories.collection.find({ where: { chainId } })

    let toUpdate = collections.map((collection) => {
      let bannerContentType
      let logoContentType
      if (collection.bannerUrl) {
        const bannerExt = extensionFromFilename(collection.bannerUrl)
        bannerContentType = contentTypeFromExt(bannerExt)
      }
      if (collection.logoUrl) {
        const logoExt = extensionFromFilename(collection.logoUrl)
        logoContentType = contentTypeFromExt(logoExt)
      }
      // check saved banner or logo image urls are incorrect
      if (!bannerContentType || !logoContentType) {
        collection.bannerUrl = null
        collection.logoUrl = null
        return collection
      } else {
        return undefined
      }
    })
    toUpdate = toUpdate.filter((collection) => collection !== undefined)
    const length = toUpdate.length > count ? count : toUpdate.length
    toUpdate = toUpdate.slice(0, length)
    await repositories.collection.saveMany(toUpdate, { chunk: MAX_SAVE_COUNTS })
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
        const collection = await repositories.collection.findOne({ where: {
          contract: ethers.utils.getAddress(contract),
          chainId,
        } })
        if (collection && collection.isSpam !== isSpam) {
          collection.isSpam = isSpam
          toUpdate.push(collection)
        }
      }),
    )
    if (toUpdate.length) {
      await repositories.collection.saveMany(toUpdate, { chunk: MAX_SAVE_COUNTS })
    }
    return { message: isSpam ? `${toUpdate.length} collections are set as spam`
      : `${toUpdate.length} collections are set as not spam`,
    }
  } catch (err) {
    Sentry.captureException(err)
    Sentry.captureMessage(`Error in updateSpamStatus: ${err}`)
    return err
  }
}

export default {
  Query: {
    collection: getCollection,
    collectionsByDeployer: getCollectionsByDeployer,
    associatedAddressesForContract:
      combineResolvers(auth.isAuthenticated, associatedAddressesForContract),
  },
  Mutation: {
    removeDuplicates: combineResolvers(auth.isAuthenticated, removeCollectionDuplicates),
    saveCollectionForContract: combineResolvers(auth.isAuthenticated, saveCollectionForContract),
    syncCollectionsWithNFTs: combineResolvers(auth.isAuthenticated, syncCollectionsWithNFTs),
    updateCollectionImageUrls: combineResolvers(auth.isAuthenticated, updateCollectionImageUrls),
    updateSpamStatus: combineResolvers(auth.isAuthenticated, updateSpamStatus),
  },
}
