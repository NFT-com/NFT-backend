import { BigNumber as BN } from 'bignumber.js'
import { ethers, utils } from 'ethers'
import { combineResolvers } from 'graphql-resolvers'
import Joi from 'joi'

import { createAlchemyWeb3 } from '@alch/alchemy-web3'
import { Context, gql, Pageable } from '@nftcom/gql/defs'
import { appError, curationError, nftError, profileError, txActivityError } from '@nftcom/gql/error'
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
  provider,
  typechain,
} from '@nftcom/shared'

const logger = _logger.Factory(_logger.Context.NFT, _logger.Context.GraphQL)

import { differenceInMilliseconds } from 'date-fns'

import { BaseCoin } from '@nftcom/gql/defs/gql'
import { getCollectionDeployer } from '@nftcom/gql/service/alchemy.service'
import { cache, CacheKeys } from '@nftcom/gql/service/cache.service'
import { saveUsersForAssociatedAddress } from '@nftcom/gql/service/core.service'
import { createLooksrareListing, retrieveOrdersLooksrare } from '@nftcom/gql/service/looksare.service'
import {
  checkNFTContractAddresses,
  getCollectionNameFromContract,
  getOwnersOfGenesisKeys, getUserWalletFromNFT,
  initiateWeb3,
  removeEdgesForNonassociatedAddresses, saveNewNFT, saveNFTMetadataImageToS3,
  syncEdgesWithNFTs,
  updateEdgesWeightForProfile, updateNFTMetadata, updateNFTOwnershipAndMetadata,
  updateNFTsForAssociatedWallet,
  updateWalletNFTs,
} from '@nftcom/gql/service/nft.service'
import { createSeaportListing, retrieveOrdersOpensea } from '@nftcom/gql/service/opensea.service'
import * as Sentry from '@sentry/node'

import { SearchEngineService } from '../service/searchEngine.service'

const PROFILE_NFTS_EXPIRE_DURATION = Number(process.env.PROFILE_NFTS_EXPIRE_DURATION)
const PROFILE_SCORE_EXPIRE_DURATION = Number(process.env.PROFILE_SCORE_EXPIRE_DURATION)
const NFT_REFRESH_DURATION = Number(process.env.NFT_REFRESH_DURATION)

const baseCoins = [
  {
    symbol: 'ETH',
    logoURI: 'https://openseauserdata.com/files/6f8e2979d428180222796ff4a33ab929.svg',
    address: '0x0000000000000000000000000000000000000000',
    decimals: 18,
    chainId: 1,
  },
  {
    symbol: 'ETH',
    logoURI: 'https://openseauserdata.com/files/6f8e2979d428180222796ff4a33ab929.svg',
    address: '0x0000000000000000000000000000000000000000',
    decimals: 18,
    chainId: 4,
  },
  {
    symbol: 'WETH',
    logoURI: 'https://openseauserdata.com/files/accae6b6fb3888cbff27a013729c22dc.svg',
    address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    decimals: 18,
    chainId: 1,
  },
  {
    symbol: 'WETH',
    logoURI: 'https://openseauserdata.com/files/accae6b6fb3888cbff27a013729c22dc.svg',
    address: '0xc778417e063141139fce010982780140aa0cd5ab',
    decimals: 18,
    chainId: 4,
  },
  {
    symbol: 'USDC',
    logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
    address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    decimals: 6,
    chainId: 1,
  },
  {
    symbol: 'USDC',
    logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
    address: '0x4dbcdf9b62e891a7cec5a2568c3f4faf9e8abe2b',
    decimals: 6,
    chainId: 4,
  },
  {
    symbol: 'DAI',
    logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x6B175474E89094C44Da98b954EedeAC495271d0F/logo.png',
    address: '0x6b175474e89094c44da98b954eedeac495271d0f',
    decimals: 18,
    chainId: 1,
  },
  {
    symbol: 'DAI',
    logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x6B175474E89094C44Da98b954EedeAC495271d0F/logo.png',
    address: '0x5592ec0cfb4dbc12d3ab100b257153436a1f0fea',
    decimals: 18,
    chainId: 4,
  },
]

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
      if (nft.metadata.traits && nft.metadata.traits?.length) {
        for ( let i = 0; i < nft.metadata.traits.length; i ++) {
          if (nft.metadata.traits[i].value) {
            nft.metadata.traits[i].value = JSON.stringify(nft.metadata.traits[i].value)
          }
        }
      }
      return nft
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

    const nft = await repositories.nft.findOne({
      where: {
        contract: utils.getAddress(args.contract),
        tokenId: ethers.BigNumber.from(args.id).toHexString(),
        chainId,
      },
    })
    if (nft) {
      // fix (short-term) : trait value
      if (nft.metadata.traits && nft.metadata.traits?.length) {
        for ( let i = 0; i < nft.metadata.traits.length; i ++) {
          if (nft.metadata.traits[i].value) {
            nft.metadata.traits[i].value = JSON.stringify(nft.metadata.traits[i].value)
          }
        }
      }
      const now = helper.toUTCDate()
      let duration
      if (nft.lastRefreshed) {
        duration = differenceInMilliseconds(now, nft.lastRefreshed)
      }
      if (!nft.lastRefreshed  ||
        (duration && duration > NFT_REFRESH_DURATION)
      ) {
        repositories.nft.updateOneById(nft.id, { lastRefreshed: now })
          .then((nft) => {
            const obj = {
              contract: {
                address: nft.contract,
              },
              id: {
                tokenId: nft.tokenId,
              },
            }
            getUserWalletFromNFT(nft.contract, nft.tokenId, chainId)
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
                    logger.info(`Updated NFT ownership and metadata for contract ${nft.contract} and tokenId ${nft.tokenId}`)
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

const getMyNFTs = async (
  _: unknown,
  args: gql.QueryNFTsArgs,
  ctx: Context,
): Promise<gql.NFTsOutput> => {
  const { user, chain } = ctx
  logger.debug('getMyNFTs', { loggedInUserId: user.id, input: args?.input })
  const pageInput = args?.input?.pageInput
  const chainId = chain.id || process.env.CHAIN_ID
  auth.verifyAndGetNetworkChain('ethereum', chainId)

  const schema = Joi.object().keys({
    profileId: Joi.string().required(),
    pageInput: Joi.any(),
  })
  const { input } = args

  joi.validateSchema(schema, input)

  const { profileId } = helper.safeObject(args?.input)

  // ensure profileId is owned by user.id
  const profile = await ctx.repositories.profile.findById(profileId)
  if (profile.ownerUserId != user.id) {
    return Promise.reject(appError.buildNotFound(
      nftError.buildProfileNotOwnedMsg(profile?.url || profileId, user.id),
      nftError.ErrorType.NFTNotOwned,
    ))
  }

  const filter: Partial<entity.Edge> = helper.removeEmpty({
    thisEntityType: defs.EntityType.Profile,
    thisEntityId: profileId,
    thatEntityType: defs.EntityType.NFT,
    edgeType: defs.EdgeType.Displays,
  })
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
            if (nft.metadata.traits && nft.metadata.traits?.length) {
              for ( let i = 0; i < nft.metadata.traits.length; i ++) {
                if (nft.metadata.traits[i].value) {
                  nft.metadata.traits[i].value = JSON.stringify(nft.metadata.traits[i].value)
                }
              }
            }
            return nft
          })
        }),
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
    const ALCHEMY_API_URL = chainId === '1' ? process.env.ALCHEMY_API_URL :
      (chainId === '5' ? process.env.ALCHEMY_API_URL_GOERLI : process.env.ALCHEMY_API_URL_RINKEBY)
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

export const saveProfileScore = async (
  repositories: db.Repository,
  profile: entity.Profile,
): Promise<void> => {
  try {
    const gkContractAddress = contracts.genesisKeyAddress(profile.chainId)
    // get genesis key numbers
    const gkNFTs = await repositories.nft.find({
      where: { userId: profile.ownerUserId, contract: gkContractAddress, chainId: profile.chainId },
    })
    // get collections
    const nfts = await repositories.nft.find({
      where: { userId: profile.ownerUserId, chainId: profile.chainId },
    })

    const collections: Array<string> = []
    await Promise.allSettled(
      nfts.map(async (nft) => {
        const collection = await repositories.collection.findOne({
          where: { contract: nft.contract, chainId: profile.chainId },
        })
        if (collection) {
          const isExisting = collections.find((existingCollection) =>
            existingCollection === collection.contract,
          )
          if (!isExisting) collections.push(collection.contract)
        }
      }),
    )
    // get visible items
    const edges = await repositories.edge.find({
      where: {
        thisEntityId: profile.id,
        thisEntityType: defs.EntityType.Profile,
        thatEntityType: defs.EntityType.NFT,
        edgeType: defs.EdgeType.Displays,
        hide: false,
      },
    })
    const paddedGK =  gkNFTs.length.toString().padStart(5, '0')
    const paddedCollections = collections.length.toString().padStart(5, '0')
    const score = edges.length.toString().concat(paddedCollections).concat(paddedGK)
    await cache.zadd(`LEADERBOARD_${profile.chainId}`, score, profile.id)
  } catch (err) {
    Sentry.captureMessage(`Error in saveProfileScore: ${err}`)
    return err
  }
}

export const saveVisibleNFTsForProfile = async (
  profileId: string,
  repositories: db.Repository,
): Promise<void> => {
  try {
    const edges = await repositories.edge.find({
      where: {
        thisEntityId: profileId,
        thisEntityType: defs.EntityType.Profile,
        thatEntityType: defs.EntityType.NFT,
        edgeType: defs.EdgeType.Displays,
        hide: false,
      },
    })
    if (edges.length) {
      await repositories.profile.updateOneById(profileId, { visibleNFTs: edges.length })
    }
  } catch (err) {
    Sentry.captureMessage(`Error in saveVisibleNFTsForProfile: ${err}`)
    return err
  }
}

const updateGKIconVisibleStatus = async (
  repositories: db.Repository,
  chainId: string,
  profile: entity.Profile,
): Promise<void> => {
  try {
    const gkOwners = await getOwnersOfGenesisKeys(chainId)
    const wallet = await repositories.wallet.findById(profile.ownerWalletId)
    const index = gkOwners.findIndex((owner) => ethers.utils.getAddress(owner) === wallet.address)
    if (index === -1) {
      await repositories.profile.updateOneById(profile.id, { gkIconVisible: false })
    } else {
      return
    }
  } catch (err) {
    Sentry.captureMessage(`Error in updateGKIconVisibleStatus: ${err}`)
    return err
  }
}

const updateNFTsForAssociatedAddresses = async (
  repositories: db.Repository,
  profile: entity.Profile,
  chainId: string,
): Promise<string> => {
  try {
    const cacheKey = `${CacheKeys.ASSOCIATED_ADDRESSES}_${chainId}_${profile.url}`
    const cachedData = await cache.get(cacheKey)
    let addresses: string[]
    if (cachedData) {
      addresses = JSON.parse(cachedData)
    } else {
      const nftResolverContract = typechain.NftResolver__factory.connect(
        contracts.nftResolverAddress(chainId),
        provider.provider(Number(chainId)),
      )
      const associatedAddresses = await nftResolverContract.associatedAddresses(profile.url)
      addresses = associatedAddresses.map((item) => item.chainAddr)
      logger.debug(`${addresses.length} associated addresses for profile ${profile.url}`)
      // remove NFT edges for non-associated addresses
      await removeEdgesForNonassociatedAddresses(
        profile.id,
        profile.associatedAddresses,
        addresses,
        chainId,
      )
      if (!addresses.length) {
        return `No associated addresses of ${profile.url}`
      }
      await cache.set(cacheKey, JSON.stringify(addresses), 'EX', 60 * 5)
      // update associated addresses with the latest updates
      await repositories.profile.updateOneById(profile.id, { associatedAddresses: addresses })
    }
    // save User, Wallet for associated addresses...
    const wallets: entity.Wallet[] = []
    await Promise.allSettled(
      addresses.map(async (address) => {
        wallets.push(await saveUsersForAssociatedAddress(chainId, address, repositories))
      }),
    )
    // refresh NFTs for associated addresses...
    await Promise.allSettled(
      wallets.map(async (wallet) => {
        await updateNFTsForAssociatedWallet(profile.id, wallet)
      }),
    )
    await syncEdgesWithNFTs(profile.id)
    return `refreshed NFTs for associated addresses of ${profile.url}`
  } catch (err) {
    Sentry.captureMessage(`Error in updateNFTsForAssociatedAddresses: ${err}`)
    return `error while refreshing NFTs for associated addresses of ${profile.url}`
  }
}

const updateCollectionForAssociatedContract = async (
  repositories: db.Repository,
  profile: entity.Profile,
  chainId: string,
  walletAddress: string,
): Promise<string> => {
  try {
    const cacheKey = `${CacheKeys.ASSOCIATED_CONTRACT}_${chainId}_${profile.url}`
    const cachedData = await cache.get(cacheKey)
    let contract
    if (cachedData) {
      contract = JSON.parse(cachedData)
    } else {
      const nftResolverContract = typechain.NftResolver__factory.connect(
        contracts.nftResolverAddress(chainId),
        provider.provider(Number(chainId)),
      )
      const associatedContract = await nftResolverContract.associatedContract(profile.url)
      if (!associatedContract) {
        return `No associated contract of ${profile.url}`
      }
      if (!associatedContract.chainAddr) {
        return `No associated contract of ${profile.url}`
      }
      contract = associatedContract.chainAddr
      await cache.set(cacheKey, JSON.stringify(contract), 'EX', 60 * 5)
      // update associated contract with the latest updates
      await repositories.profile.updateOneById(profile.id, { associatedContract: contract })
    }
    // get collection info
    let collectionName = await getCollectionNameFromContract(
      contract,
      chainId,
      defs.NFTType.ERC721,
    )
    if (collectionName === 'Unknown Name') {
      collectionName = await getCollectionNameFromContract(
        contract,
        chainId,
        defs.NFTType.ERC1155,
      )
    }
    // check if deployer of associated contract is in associated addresses
    const deployer = await getCollectionDeployer(contract, chainId)
    if (!deployer) {
      if (profile.profileView === defs.ProfileViewType.Collection) {
        await repositories.profile.updateOneById(profile.id,
          {
            profileView: defs.ProfileViewType.Gallery,
          },
        )
      }
      return `Updated associated contract for ${profile.url}`
    } else {
      const collection = await repositories.collection.findByContractAddress(contract, chainId)
      if (!collection) {
        const savedCollection = await repositories.collection.save({
          contract,
          name: collectionName,
          chainId,
          deployer,
        })
        await seService.indexCollections([savedCollection])
      }
      const checkedDeployer =  ethers.utils.getAddress(deployer)
      const isAssociated = profile.associatedAddresses.indexOf(checkedDeployer) !== -1 ||
        checkedDeployer === walletAddress
      if (!isAssociated && profile.profileView === defs.ProfileViewType.Collection) {
        await repositories.profile.updateOneById(profile.id,
          {
            profileView: defs.ProfileViewType.Gallery,
          },
        )
      }
      return `Updated associated contract for ${profile.url}`
    }
  } catch (err) {
    Sentry.captureMessage(`Error in updateCollectionForAssociatedContract: ${err}`)
    return `error while updating associated contract of ${profile.url}`
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
    const chainId = args?.input.chainId || process.env.CHAIN_ID
    auth.verifyAndGetNetworkChain('ethereum', chainId)

    const pageInput = args?.input.pageInput
    initiateWeb3(chainId)

    return repositories.profile.findOne({
      where: {
        id: args?.input.profileId,
        chainId,
      },
    })
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
            const updateBegin = Date.now()
            repositories.profile.updateOneById(profile.id, {
              nftsLastUpdated: now,
            }).then(() => repositories.wallet.findOne({
              where: {
                id: profile.ownerWalletId,
                chainId,
              },
            })
              .then((wallet: entity.Wallet) => {
                return checkNFTContractAddresses(
                  profile.ownerUserId,
                  wallet.id,
                  wallet.address,
                  chainId,
                )
                  .then(() => {
                    logger.debug('checked NFT contract addresses in updateNFTsForProfile', profile.id)
                    return updateWalletNFTs(
                      profile.ownerUserId,
                      wallet.id,
                      wallet.address,
                      chainId,
                    ).then(() => {
                      logger.debug('updated wallet NFTs in updateNFTsForProfile', profile.id)
                      return updateEdgesWeightForProfile(profile.id, profile.ownerWalletId)
                        .then(() => {
                          logger.debug('updated edges with weight in updateNFTsForProfile', profile.id)
                          return syncEdgesWithNFTs(profile.id)
                            .then(() => {
                              logger.debug('synced edges with NFTs in updateNFTsForProfile', profile.id)
                              // save visible NFT amount of profile
                              return saveVisibleNFTsForProfile(profile.id, repositories)
                                .then(() => {
                                  logger.debug('saved amount of visible NFTs to profile', profile.id)
                                  // refresh NFTs for associated addresses
                                  return updateNFTsForAssociatedAddresses(
                                    repositories,
                                    profile,
                                    chainId,
                                  ).then((msg) => {
                                    logger.debug(msg)
                                    // update associated contract
                                    return updateCollectionForAssociatedContract(
                                      repositories,
                                      profile,
                                      chainId,
                                      wallet.address,
                                    ).then((msg) => {
                                      logger.debug(msg)
                                      // if gkIconVisible is true, we check if this profile owner still owns genesis key,
                                      if (profile.gkIconVisible) {
                                        return updateGKIconVisibleStatus(
                                          repositories,
                                          chainId,
                                          profile,
                                        ).then(() => {
                                          logger.debug(`gkIconVisible updated for profile ${profile.id}`)
                                          const updateEnd = Date.now()
                                          logger.debug(`updateNFTsForProfile took ${(updateEnd - updateBegin) / 1000} seconds to update NFTs`)
                                        })
                                      } else {
                                        const updateEnd = Date.now()
                                        logger.debug(`updateNFTsForProfile took ${(updateEnd - updateBegin) / 1000} seconds to update NFTs`)
                                      }
                                    })
                                  })
                                })
                            })
                        })
                    })
                  })
              }))
          }

          let scoreDuration
          if (profile.lastScored) {
            scoreDuration = differenceInMilliseconds(now, profile.lastScored)
          }
          // if there is profile score is not calculated yet or should be updated,
          if (!profile.lastScored ||
            (scoreDuration && scoreDuration > PROFILE_SCORE_EXPIRE_DURATION)
          ) {
            repositories.profile.updateOneById(profile.id, {
              lastScored: now,
            }).then(() => {
              return saveProfileScore(repositories, profile)
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
          )
        }
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

const getExternalListings = async (
  _: any,
  args: gql.QueryExternalListingsArgs,
  ctx: Context,
): Promise<gql.ExternalListingsOutput> => {
  logger.debug('getExternalListings', {
    contract: args?.contract,
    id: args?.tokenId,
    chainId: args?.chainId,
    caller: ctx.user?.id,
  })
  try {
    const chainId = args?.chainId || process.env.CHAIN_ID
    auth.verifyAndGetNetworkChain('ethereum', chainId)
    const key = `${args?.contract?.toLowerCase()}-${args?.tokenId}-${chainId}`
    const cachedData = await cache.get(key)
    if (process.env.ACTIVITY_ENDPOINTS_ENABLED === 'false') {
      return { listings: [] }
    } else if (cachedData) {
      return JSON.parse(cachedData)
    } else {
      // 1. Opensea
      // get selling & buying orders...
      const allOrder = await retrieveOrdersOpensea(args?.contract, args?.tokenId, chainId)
      if (allOrder) logger.info('========== allOrder: ', JSON.stringify(allOrder, null, 2))
      let bestOffer = undefined
      if (allOrder?.offers?.seaport?.length) {
        bestOffer = allOrder.offers?.seaport?.[0]
        for (let i = 1; i < allOrder.offers?.seaport?.length; i++) {
          const price0 = new BN(bestOffer.current_price)
            .shiftedBy(-bestOffer.maker_asset_bundle.assets?.[0].decimals)
          const price1 = new BN(allOrder.offers?.seaport?.[i].current_price)
            .shiftedBy(-allOrder.offers?.seaport?.[i].maker_asset_bundle?.[0].decimals)
          if (price0.lt(price1))
            bestOffer = allOrder.offers?.seaport?.[0]
        }
      } else if (allOrder?.offers?.v1?.length) {
        bestOffer = allOrder?.offers?.v1?.[0]
        for (let i = 1; i < allOrder?.offers?.v1?.length; i++) {
          const usdPrice0 = new BN(bestOffer.current_price)
            .shiftedBy(-bestOffer.payment_token_contract.decimals)
            .multipliedBy(bestOffer.payment_token_contract.usd_price)
          const usdPrice1 = new BN(allOrder?.offers?.v1?.[i].current_price)
            .shiftedBy(-allOrder?.offers?.v1?.[i].payment_token_contract.decimals)
            .multipliedBy(allOrder?.offers?.v1?.[i].payment_token_contract.usd_price)
          if (usdPrice0.lt(usdPrice1))
            bestOffer = allOrder?.offers?.v1?.[i]
        }
      }

      let createdDate, expiration, baseCoin
      if (allOrder?.listings?.seaport?.length) {
        const seaportListing = allOrder.listings?.seaport?.[0]
        createdDate = new Date(seaportListing?.created_date)
        expiration = new Date(seaportListing?.expiration_time * 1000)
        baseCoin = {
          symbol:
            seaportListing?.taker_asset_bundle.assets?.[0]?.asset_contract?.symbol ??
            seaportListing?.taker_asset_bundle.assets?.[0]?.asset_contract.name,
          logoURI: seaportListing?.taker_asset_bundle?.assets?.[0]?.image_url,
          address:
            seaportListing?.taker_asset_bundle?.assets?.[0]?.asset_contract.address,
          decimals: seaportListing?.taker_asset_bundle?.assets?.[0]?.decimals,
        } as BaseCoin
      } else if (allOrder?.listings?.v1?.length) {
        createdDate = new Date(allOrder?.listings?.v1?.[0].created_date)
        expiration = new Date(allOrder?.listings?.v1?.[0].expiration_time * 1000)
        baseCoin = {
          symbol: allOrder?.listings?.v1?.[0].payment_token_contract.symbol,
          logoURI: allOrder?.listings?.v1?.[0].payment_token_contract.image_url,
          address: allOrder?.listings?.v1?.[0].payment_token_contract.address,
          decimals: allOrder?.listings?.v1?.[0].payment_token_contract.decimals,
        } as BaseCoin
      }

      const opensea = {
        url: (allOrder?.listings?.seaport?.length) ?
          allOrder.listings?.seaport?.[0]?.maker_asset_bundle.assets?.[0]?.permalink :
          allOrder?.listings?.v1?.length ?
            `https://opensea.io/assets/ethereum/${args?.contract}/${args?.tokenId}`
            : null,
        exchange: gql.SupportedExternalExchange.Opensea,
        price: allOrder?.listings?.seaport?.length ?
          allOrder.listings?.seaport?.[0]?.current_price :
          allOrder?.listings?.v1?.length ?
            allOrder?.listings?.v1?.[0]?.current_price :
            null,
        highestOffer: bestOffer ? bestOffer?.current_price : null,
        expiration: expiration ?? null,
        creation:  createdDate?? null,
        baseCoin: baseCoin ?? null,
      }

      // 2. Looksrare
      const looksrareSellOrders = await retrieveOrdersLooksrare(
        args?.contract,
        args?.tokenId,
        args?.chainId,
        true,
        'VALID',
      )
      const url = chainId === '4' ? `https://rinkeby.looksrare.org/collections/${args?.contract}/${args?.tokenId}` :
        (chainId === '1' ? `https://looksrare.org/collections/${args?.contract}/${args?.tokenId}` : null)
      let looksrareCreatedDate, looksrareExpiration, looksrareBaseCoin
      if (looksrareSellOrders && looksrareSellOrders.length) {
        looksrareCreatedDate = new Date(looksrareSellOrders[0].startTime * 1000)
        looksrareExpiration = new Date(looksrareSellOrders[0].endTime * 1000)
        looksrareBaseCoin = baseCoins.find((coin) =>
          coin.address === looksrareSellOrders[0].currencyAddress.toLowerCase(),
        )
      }
      const looksrare = {
        url: looksrareSellOrders && looksrareSellOrders.length ? url : null,
        exchange: gql.SupportedExternalExchange.Looksrare,
        price: looksrareSellOrders && looksrareSellOrders.length ?
          looksrareSellOrders[0].price : null,
        highestOffer: null,
        expiration: looksrareExpiration ?? null,
        creation: looksrareCreatedDate ?? null,
        baseCoin: looksrareBaseCoin ?? null,
      }

      const finalData = process.env.ACTIVITY_ENDPOINTS_ENABLED !== 'false' ?
        { listings: [opensea, looksrare] } :
        { listings: [] }

      await cache.set(key, JSON.stringify(finalData), 'EX', 60 * 30)

      return finalData
    }
  } catch (err) {
    Sentry.captureMessage(`Error in getExternalListings: ${err}`)
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
      const nft = await repositories.nft.findOne({
        where: {
          id: args?.id,
          chainId,
        },
      })

      if (nft) {
        // fix (short-term) : trait value
        if (nft.metadata.traits && nft.metadata.traits?.length) {
          for ( let i = 0; i < nft.metadata.traits.length; i ++) {
            if (nft.metadata.traits[i].value) {
              nft.metadata.traits[i].value = JSON.stringify(nft.metadata.traits[i].value)
            }
          }
        }

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
    if (nft.metadata.traits && nft.metadata.traits?.length) {
      for ( let i = 0; i < nft.metadata.traits.length; i ++) {
        if (nft.metadata.traits[i].value) {
          nft.metadata.traits[i].value = JSON.stringify(nft.metadata.traits[i].value)
        }
      }
    }
    return nft
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
                const nft = await repositories.nft.findById(edge.thatEntityId)
                if (nft) {
                  // fix (short-term) : trait value
                  if (nft.metadata.traits && nft.metadata.traits?.length) {
                    for ( let i = 0; i < nft.metadata.traits.length; i ++) {
                      if (nft.metadata.traits[i].value) {
                        nft.metadata.traits[i].value = JSON.stringify(nft.metadata.traits[i].value)
                      }
                    }
                  }
                  nfts.push(nft)
                }
              }
              logger.info(`${nfts.length} NFTs for collection ${collectionAddress}`)
            }
            await cache.set(key, JSON.stringify(nfts), 'EX', 60 * 30)
          }

          const length = Math.min(nfts.length, count)
          result.push({
            collectionAddress: ethers.utils.getAddress(collectionAddress),
            nfts: nfts.slice(0, length),
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
    if (updatedNFT.metadata.traits && updatedNFT.metadata.traits?.length) {
      for ( let i = 0; i < updatedNFT.metadata.traits.length; i ++) {
        if (updatedNFT.metadata.traits[i].value) {
          updatedNFT.metadata.traits[i].value = JSON.stringify(updatedNFT.metadata.traits[i].value)
        }
      }
    }
    return updatedNFT
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
  logger.debug('listNFTSeaport', { input: args?.input, wallet: ctx?.wallet?.id })

  return createSeaportListing(seaportSignature, seaportParams, chainId)
    .then(fp.thruIfNotEmpty((order: entity.TxOrder) => {
      return repositories.txOrder.save(order)
    }))
    .then(order => !!order.id)
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

  logger.debug('listNFTLooksrare', { input: args?.input, wallet: ctx?.wallet?.id })

  return createLooksrareListing(looksrareOrder, chainId)
    .then(fp.thruIfNotEmpty((order: entity.TxOrder) => {
      return repositories.txOrder.save(order)
    }))
    .then(order => !!order.id)
    .catch(err => appError.buildInvalid(
      txActivityError.buildLooksRare(err),
      txActivityError.ErrorType.LooksRare,
    ))
}

const uploadMetadataImagesToS3 = async (
  _: any,
  args: gql.MutationUploadMetadataImagesToS3Args,
  ctx: Context,
): Promise<gql.UploadMetadataImagesToS3Output> => {
  const { repositories, chain } = ctx
  const chainId = chain.id || process.env.CHAIN_ID
  auth.verifyAndGetNetworkChain('ethereum', chainId)
  logger.debug('uploadMetadataImagesToS3', { count: args?.count })
  try {
    const nfts = await repositories.nft.find({ where: { previewLink: null, previewLinkError: null, chainId } })
    const filteredNFTs = nfts.filter((nft) => nft.metadata.imageURL && nft.metadata.imageURL.length)
    const count = Math.min(Number(args?.count), filteredNFTs.length)
    const slidedNFTs = filteredNFTs.slice(0, count)
    await Promise.allSettled(
      slidedNFTs.map(async (nft) => {
        const previewLink = await saveNFTMetadataImageToS3(nft, repositories)
        if (previewLink) {
          await repositories.nft.updateOneById(nft.id, { previewLink })
        }
      }),
    )
    logger.debug('Preview link of metadata image for NFTs are saved', { counts: slidedNFTs.length })
    return {
      message: `Saved preview link of metadata image for ${slidedNFTs.length} NFTs`,
    }
  } catch (err) {
    console.log(err)
    Sentry.captureMessage(`Error in uploadMetadataImagesToS3: ${err}`)
    return err
  }
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
    externalListings: getExternalListings,
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
    uploadMetadataImagesToS3: combineResolvers(auth.isAuthenticated, uploadMetadataImagesToS3),
    updateENSNFTMetadata: combineResolvers(auth.isAuthenticated, updateENSNFTMetadata),
    listNFTSeaport,
    listNFTLooksrare,

  },
  NFT: {
    collection: core.resolveEntityById<gql.NFT, entity.Collection>(
      'contract',
      defs.EntityType.NFT,
      defs.EntityType.Collection,
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
  },
}
