import cryptoRandomString from 'crypto-random-string'
import { addDays } from 'date-fns'
import { BigNumber, ethers, utils } from 'ethers'
import { combineResolvers } from 'graphql-resolvers'
import { GraphQLUpload } from 'graphql-upload'
import { FileUpload } from 'graphql-upload'
import Joi from 'joi'
import stream from 'stream'

import { S3Client } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { assetBucket } from '@nftcom/gql/config'
import { Context, gql } from '@nftcom/gql/defs'
import { appError, mintError, profileError } from '@nftcom/gql/error'
import { auth, joi, pagination } from '@nftcom/gql/helper'
import { safeInput } from '@nftcom/gql/helper/pagination'
import { saveProfileScore, saveVisibleNFTsForProfile } from '@nftcom/gql/resolver/nft.resolver'
import { core } from '@nftcom/gql/service'
import { cache, CacheKeys } from '@nftcom/gql/service/cache.service'
import {
  contentTypeFromExt,
  DEFAULT_NFT_IMAGE, extensionFromFilename,
  generateCompositeImage,
  getAWSConfig,
  s3ToCdn,
} from '@nftcom/gql/service/core.service'
import {
  changeNFTsVisibility, getCollectionInfo,
  getOwnersOfGenesisKeys,
  updateNFTsOrder,
} from '@nftcom/gql/service/nft.service'
import { _logger, contracts, db,defs, entity, fp, helper, provider, typechain } from '@nftcom/shared'
import * as Sentry from '@sentry/node'

import { blacklistBool } from '../service/core.service'

const logger = _logger.Factory(_logger.Context.Profile, _logger.Context.GraphQL)

const MAX_SAVE_COUNTS = 500

type S3UploadStream = {
  writeStream: stream.PassThrough
  upload: Upload
};

type LeaderboardInfo = {
  gkCount: number
  collectionCount: number
  edgeCount: number
}

const toProfilesOutput = (profiles: entity.Profile[]): gql.ProfilesOutput => {
  return {
    items: profiles,
    pageInfo: null,
    totalItems: profiles.length,
  }
}

// TODO implement pagination
const getProfilesFollowedByMe = (
  _: any,
  args: gql.QueryProfilesFollowedByMeArgs,
  ctx: Context,
): Promise<gql.ProfilesOutput> => {
  const { user } = ctx
  logger.debug('getProfilesFollowedByMe', { loggedInUserId: user.id, input: args?.input })
  const { statuses } = helper.safeObject(args?.input)
  return core.thatEntitiesOfEdgesBy<entity.Profile>(ctx, {
    collectionId: user.id,
    thatEntityType: defs.EntityType.Profile,
    edgeType: defs.EdgeType.Follows,
  })
    .then(fp.filterIfNotEmpty(statuses)((p) => statuses.includes(p.status)))
    .then(toProfilesOutput)
}

// TODO implement pagination
const getMyProfiles = (
  _: any,
  args: gql.QueryMyProfilesArgs,
  ctx: Context,
): Promise<gql.ProfilesOutput> => {
  const { user } = ctx
  logger.debug('getMyProfiles', { loggedInUserId: user.id, input: args?.input })
  const { statuses } = helper.safeObject(args?.input)
  const filter: Partial<entity.Profile> = helper.removeEmpty({
    status: helper.safeIn(statuses),
    ownerUserId: user.id,
  })
  return core.entitiesBy(ctx.repositories.profile, filter)
    .then(toProfilesOutput)
}

const buildProfileInputSchema = (profileIdKey = 'id'): Joi.ObjectSchema =>
  Joi.object().keys({
    [profileIdKey]: Joi.string().required(),
  })

// TODO implement pagination
const getProfileFollowers = (
  _: any,
  args: gql.QueryProfileFollowersArgs,
  ctx: Context,
): Promise<gql.FollowersOutput> => {
  const { user } = ctx
  logger.debug('getProfileFollowers', { loggedInUserId: user?.id, input: args.input })

  joi.validateSchema(buildProfileInputSchema('profileId'), args.input)

  return core.thisEntitiesOfEdgesBy<entity.Wallet>(ctx, {
    thatEntityId: args.input.profileId,
    thatEntityType: defs.EntityType.Profile,
    edgeType: defs.EdgeType.Follows,
  })
    .then((wallets) => ({
      items: wallets,
      pageInfo: null,
      totalItems: wallets.length,
    }))
}

const createFollowEdge = (ctx: Context) => {
  return (profile: entity.Profile): Promise<entity.Edge | boolean> => {
    const { user, wallet, repositories } = ctx
    return repositories.edge.exists({
      collectionId: user.id,
      edgeType: defs.EdgeType.Follows,
      thatEntityId: profile.id,
      thatEntityType: defs.EntityType.Profile,
      deletedAt: null,
    })
      .then(fp.thruIfFalse(() => core.createEdge(ctx,  {
        collectionId: user.id,
        thisEntityId: wallet.id,
        thisEntityType: defs.EntityType.Wallet,
        edgeType: defs.EdgeType.Follows,
        thatEntityId: profile.id,
        thatEntityType: defs.EntityType.Profile,
      })))
  }
}

const followProfile = (
  _: any,
  args: gql.MutationFollowProfileArgs,
  ctx: Context,
): Promise<gql.Profile> => {
  const { user, wallet } = ctx
  logger.debug('followProfile', { loggedInUserId: user.id, input: args, wallet })

  const schema = Joi.object().keys({ url: Joi.string() })
  joi.validateSchema(schema, args)

  const { url } = args
  return core.createProfile(ctx, { url, chainId: wallet.chainId })
    .then(fp.tapWait(createFollowEdge(ctx)))
}

const getProfile = (
  lookupVal: string,
  fbFn: (k: string) => Promise<entity.Profile>,
): Promise<entity.Profile | never> => {
  return fbFn(lookupVal)
    .then(fp.rejectIfEmpty(appError.buildNotFound(
      profileError.buildProfileNotFoundMsg(lookupVal),
      profileError.ErrorType.ProfileNotFound,
    )))
}

const unfollowProfile = (
  _: any,
  args: gql.MutationUnfollowProfileArgs,
  ctx: Context,
): Promise<gql.Profile> => {
  const { user, wallet, repositories } = ctx
  logger.debug('followProfile', { loggedInUserId: user.id, input: args, wallet })

  joi.validateSchema(buildProfileInputSchema(), args)

  return getProfile(args.id, repositories.profile.findById)
    .then(fp.tapWait((profile) => {
      return repositories.edge.delete({
        collectionId: user.id,
        edgeType: defs.EdgeType.Follows,
        thatEntityId: profile.id,
        thatEntityType: defs.EntityType.Profile,
        deletedAt: null,
      })
    }))
}

const getProfileByURLPassive = (
  _: any,
  args: gql.QueryProfileArgs,
  ctx: Context,
): Promise<gql.Profile> => {
  const { user } = ctx
  logger.debug('getProfileByURLPassive', { loggedInUserId: user?.id, input: args })
  const schema = Joi.object().keys({
    url: Joi.string().required(),
    chainId: Joi.string().optional(),
  })
  joi.validateSchema(schema, args)
  const chainId = args?.chainId || process.env.CHAIN_ID
  auth.verifyAndGetNetworkChain('ethereum', chainId)

  return ctx.repositories.profile.findOne({
    where: {
      url: args.url,
      chainId,
    },
  })
    .then(fp.rejectIfEmpty(appError.buildExists(
      profileError.buildProfileNotFoundMsg(args.url),
      profileError.ErrorType.ProfileNotFound,
    )))
}

type FnProfileToProfile = (profile: entity.Profile) => Promise<entity.Profile>

/**
 * Takes a profile, checks the on-chain owner, and updates the entity if it is not the same.
 * When updating, we also clear all customization options.
 */
const maybeUpdateProfileOwnership = (
  ctx: Context,
  nftProfileContract: typechain.NftProfile,
  chainId: string,
): FnProfileToProfile => {
  return (profile: entity.Profile): Promise<entity.Profile> => {
    return Promise.all([
      nftProfileContract.ownerOf(profile.tokenId),
      ctx.repositories.wallet.findById(profile.ownerWalletId),
    ])
      .then(([trueOwner, wallet]: [string, entity.Wallet]) => {
        const chain = auth.verifyAndGetNetworkChain('ethereum', chainId)
        if (ethers.utils.getAddress(trueOwner) !== ethers.utils.getAddress(wallet.address)) {
          return ctx.repositories.wallet.findByChainAddress(chainId, trueOwner)
            .then(fp.thruIfEmpty(() =>
              ctx.repositories.user.save({
                email: null,
                username: `ethereum-${ethers.utils.getAddress(trueOwner)}`,
                referredBy: null,
                avatarURL: null,
                confirmEmailToken: cryptoRandomString({ length: 6, type: 'numeric' }),
                confirmEmailTokenExpiresAt: addDays(helper.toUTCDate(), 1),
                referralId: cryptoRandomString({ length: 10, type: 'url-safe' }),
              })
                .then((user: entity.User) =>
                  ctx.repositories.wallet.save({
                    userId: user.id,
                    network: 'ethereum',
                    chainId,
                    chainName: chain.name,
                    address: trueOwner,
                  }),
                ),
            ))
            .then((wallet: entity.Wallet) => {
              return Promise.all([
                ctx.repositories.user.findById(wallet.userId),
                Promise.resolve(wallet),
              ])
            })
            .then(([user, wallet]) => ctx.repositories.profile.save({
              id: profile.id,
              url: profile.url,
              ownerUserId: user.id,
              ownerWalletId: wallet.id,
              tokenId: profile.tokenId,
              status: profile.status,
              chainId: wallet.chainId || process.env.CHAIN_ID,
              bannerURL: null,
              photoURL: null,
              description: null,
              nftsLastUpdated: null,
              displayType: defs.ProfileDisplayType.NFT,
              layoutType: defs.ProfileLayoutType.Default,
            }))
            .then(fp.tap(() => ctx.repositories.edge.hardDelete({
              edgeType: defs.EdgeType.Displays,
              thisEntityType: defs.EntityType.Profile,
              thatEntityType: defs.EntityType.NFT,
              thisEntityId: profile.id,
            })))
        } else {
          return profile
        }
      })
  }
}

const getProfileByURL = (
  _: any,
  args: gql.QueryProfileArgs,
  ctx: Context,
): Promise<gql.Profile> => {
  const { user } = ctx
  logger.debug('getProfileByURL', { loggedInUserId: user?.id, input: args })
  const schema = Joi.object().keys({
    url: Joi.string().required(),
    chainId: Joi.string().optional(),
  })
  joi.validateSchema(schema, args)

  const chainId = args?.chainId || process.env.CHAIN_ID
  const chain = auth.verifyAndGetNetworkChain('ethereum', chainId)
  const nftProfileContract = typechain.NftProfile__factory.connect(
    contracts.nftProfileAddress(chain.id),
    provider.provider(Number(chain.id)),
  )

  return ctx.repositories.profile.findOne({
    where: {
      url: args.url,
      chainId: chainId,
    },
  })
    .then(fp.thruIfNotEmpty(maybeUpdateProfileOwnership(ctx, nftProfileContract, chain.id)))
    .then(fp.thruIfEmpty(() => nftProfileContract.getTokenId(args.url)
      .then(fp.rejectIfEmpty(appError.buildExists(
        profileError.buildProfileNotFoundMsg(args.url),
        profileError.ErrorType.ProfileNotFound,
      )))
      .then((tokenId: BigNumber) => {
        return nftProfileContract.ownerOf(tokenId)
          .then((owner: string) => [tokenId, owner])
      })
      .then(([tokenId, owner]: [BigNumber, string]) => {
        return core.createProfileFromEvent(
          chain.id,
          owner,
          tokenId,
          ctx.repositories,
          args.url,
        )
      })))
}

const getWinningBid = (
  parent: gql.Profile,
  _: unknown,
  ctx: Context,
): Promise<gql.Bid> => {
  const { user, repositories } = ctx
  logger.debug('getWinningBid', { loggedInUserId: user?.id })
  return repositories.bid.findTopBidByProfile(parent.id)
}

const updateProfile = (
  _: any,
  args: gql.MutationUpdateProfileArgs,
  ctx: Context,
): Promise<gql.Profile> => {
  const { user, repositories, wallet } = ctx
  logger.debug('updateProfile', { loggedInUserId: user.id, input: args.input })

  const schema = Joi.object().keys({
    id: Joi.string().required(),
    bannerURL: Joi.string().uri().allow(null),
    description: Joi.string().allow(null),
    photoURL: Joi.string().uri().allow(null),
    showNFTIds: Joi.array().items(Joi.string()).allow(null),
    hideNFTIds: Joi.array().items(Joi.string()).allow(null),
    showAllNFTs: Joi.boolean().allow(null),
    hideAllNFTs: Joi.boolean().allow(null),
    gkIconVisible: Joi.boolean().allow(null),
    nftsDescriptionsVisible: Joi.boolean().allow(null),
    deployedContractsVisible: Joi.boolean().allow(null),
    displayType: Joi.string()
      .valid(defs.ProfileDisplayType.NFT, defs.ProfileDisplayType.Collection)
      .allow(null),
    layoutType: Joi.string()
      .valid(
        defs.ProfileLayoutType.Default,
        defs.ProfileLayoutType.Mosaic,
        defs.ProfileLayoutType.Featured,
        defs.ProfileLayoutType.Spotlight,
      )
      .allow(null),
  })
  joi.validateSchema(schema, args.input)

  const notOwner = (p: entity.Profile): boolean => p.ownerUserId !== user.id
  const { id } = args.input

  return getProfile(id, repositories.profile.findById)
    .then(fp.rejectIf(notOwner)(appError.buildForbidden(
      profileError.buildProfileNotOwnedMsg(id),
      profileError.ErrorType.ProfileNotOwned,
    )))
    .then((p: entity.Profile) => {
      p.bannerURL = args.input.bannerURL ?? p.bannerURL
      p.description = args.input.description ?? p.description
      p.photoURL = args.input.photoURL ?? p.photoURL
      p.displayType = args.input.displayType ?? p.displayType
      p.layoutType = args.input.layoutType ?? p.layoutType
      p.gkIconVisible = args.input.gkIconVisible ?? p.gkIconVisible
      p.nftsDescriptionsVisible = args.input.nftsDescriptionsVisible ?? p.nftsDescriptionsVisible
      p.deployedContractsVisible = args.input.deployedContractsVisible ?? p.deployedContractsVisible
      return changeNFTsVisibility(
        repositories,
        wallet.id,
        p.id, // profileId
        args.input.showAllNFTs,
        args.input.hideAllNFTs,
        args.input.showNFTIds,
        args.input.hideNFTIds,
        p.chainId,
      ).then(() => {
        return repositories.profile.save(p)
      })
    })
}

const getFollowersCount = (
  parent: gql.Profile,
  _: unknown,
  ctx: Context,
): Promise<number> => {
  return core.countEdges(ctx, {
    thatEntityId: parent.id,
    edgeType: defs.EdgeType.Follows,
  })
}

const getBlockedProfileURI = (
  _: unknown,
  args: gql.QueryBlockedProfileUriArgs,
): Promise<boolean> => {
  logger.debug('getBlockedProfileURI', args.url)
  return Promise.resolve(blacklistBool(args.url.toLowerCase(), args.blockReserved))
}

const getInsiderReservedProfileURIs = (
  _: any,
  args: gql.QueryInsiderReservedProfilesArgs,
  ctx: Context,
): Promise<string[]> => {
  const { wallet } = ctx

  logger.debug('getInsiderReservedProfileURIs', wallet.address, ctx.user)
  const reserved = core.reservedProfiles?.[wallet.address]
  return Promise.resolve(reserved ?? [])
}

// TODO: make sure this is running on cron job -> that pull events from:
// TODO: emit MintedProfile(_owner, _profileURI, _nftTokens, claimableBlock[hash]);
const profileClaimed = (
  _: any,
  args: gql.MutationProfileClaimedArgs,
  ctx: Context,
): Promise<gql.Profile> => {
  const { repositories } = ctx
  const { profileId, walletId, txHash } = args.input
  logger.debug('profileClaimed', { profileId, walletId, txHash })

  const profileAuction = new utils.Interface(contracts.profileAuctionABI())

  return repositories.wallet.findById(walletId)
    .then((wallet: entity.Wallet) => Promise.all([
      Promise.resolve(wallet),
      repositories.profile.findById(profileId),
      provider.provider(Number(wallet.chainId)).getTransactionReceipt(txHash),
    ]))
    .then(([wallet, profile, txReceipt]) => {
      if (
        txReceipt.from !== wallet.address ||
        txReceipt.to !== contracts.profileAuctionAddress(wallet.chainId) ||
        !txReceipt.logs.some((log) => {
          try {
            const parsed = profileAuction.parseLog(log)
            return parsed?.topic === contracts.MintedProfileTopic && (parsed?.args['_val'] ?? '') === profile.url
          } catch (error) {
            // event doesn't match our definition of ProfileAuction Contract
            return false
          }
        })
      ) {
        return appError.buildInvalid(
          mintError.buildInvalidProfileClaimTransaction(),
          mintError.ErrorType.ProfileClaimTransaction,
        )
      }
      return profile
    })
    .then(fp.rejectIf((profile: entity.Profile) => profile.ownerWalletId !== walletId)(
      appError.buildInvalid(
        profileError.buildProfileNotOwnedMsg(profileId),
        profileError.ErrorType.ProfileNotOwned,
      ),
    ))
    .then((profile: entity.Profile) => {
      profile.status = defs.ProfileStatus.Owned
      profile.chainId = ctx.chain.id || process.env.CHAIN_ID

      return repositories.profile.save(profile)
    })
}

const checkFileSize = async (
  createReadStream: FileUpload['createReadStream'],
  maxSize: number,
): Promise<number> =>
  new Promise((resolves, rejects) => {
    let filesize = 0
    createReadStream().on('data', (chunk: Buffer) => {
      filesize += chunk.length
      if (filesize > maxSize) {
        rejects(filesize)
      }
    })
    createReadStream().on('end', () =>
      resolves(filesize),
    )
    createReadStream().on('error', rejects)
  })

const createUploadStream = (
  s3: S3Client,
  key: string,
  bucket: string,
): S3UploadStream => {
  const ext = extensionFromFilename(key as string)
  const contentType = contentTypeFromExt(ext)
  const pass = new stream.PassThrough()

  const s3Upload = new Upload({
    client: s3,
    params: {
      Bucket: bucket,
      Key: key,
      Body: pass,
      ContentType: contentType,
    },
  })
  s3Upload.done()
  return {
    writeStream: pass,
    upload: s3Upload,
  }
}

const uploadStreamToS3 = async (
  filename: string,
  s3: S3Client,
  stream: FileUpload['createReadStream'],
): Promise<string> => {
  try {
    const bannerKey = 'profiles/' + Date.now().toString() + '-' + filename
    const bannerUploadStream = createUploadStream(s3, bannerKey, assetBucket.name)
    stream.pipe(bannerUploadStream.writeStream)
    bannerUploadStream.upload
    return s3ToCdn(`https://${assetBucket.name}.s3.amazonaws.com/${bannerKey}`)
  } catch (e) {
    Sentry.captureException(e)
    Sentry.captureMessage(`Error in uploadStreamToS3: ${e}`)
    throw e
  }
}

const uploadProfileImages = async (
  _: any,
  args: gql.MutationUploadProfileImagesArgs,
  ctx: Context,
): Promise<gql.Profile> => {
  const { repositories } = ctx
  const { banner, avatar, profileId, description, compositeProfileURL } = args.input
  let profile = await repositories.profile.findById(profileId)
  if (!profile) {
    return Promise.reject(appError.buildNotFound(
      profileError.buildProfileNotFoundMsg(profileId),
      profileError.ErrorType.ProfileNotFound,
    ))
  }
  let bannerResponse, avatarResponse
  let bannerStream: FileUpload['createReadStream']
  let avatarStream: FileUpload['createReadStream']
  if (banner) {
    bannerResponse = await banner
    bannerStream = bannerResponse.createReadStream()
  }
  if (avatar) {
    avatarResponse = await avatar
    avatarStream = avatarResponse.createReadStream()
  }

  // 1. check banner size...
  if (bannerStream) {
    try {
      const bannerMaxSize = 5000000
      await checkFileSize(bannerStream, bannerMaxSize)
    }
    catch (e) {
      Sentry.captureException(e)
      Sentry.captureMessage(`Error in uploadProfileImages: ${e}`)
      if (typeof e === 'number') {
        return Promise.reject(appError.buildInvalid(
          profileError.buildProfileBannerFileSize(),
          profileError.ErrorType.ProfileBannerFileSize,
        ))
      }
    }
  }

  // 2. check avatar file size...
  if (avatarStream) {
    try {
      const avatarMaxSize = 2000000
      await checkFileSize(avatarStream, avatarMaxSize)
    }
    catch (e) {
      Sentry.captureException(e)
      Sentry.captureMessage(`Error in uploadProfileImages: ${e}`)
      if (typeof e === 'number') {
        return Promise.reject(appError.buildInvalid(
          profileError.buildProfileAvatarFileSize(),
          profileError.ErrorType.ProfileAvatarFileSize,
        ))
      }
    }
  }

  // 3. upload streams to AWS S3
  const s3config = await getAWSConfig()

  if (bannerResponse && bannerStream) {
    const ext = extensionFromFilename(bannerResponse.filename as string)
    const fileName = ext ? profile.url + '-banner' + '.' + ext : profile.url + '-banner'
    const bannerUrl = await uploadStreamToS3(fileName, s3config, bannerStream)
    if (bannerUrl) {
      await repositories.profile.updateOneById(profileId, {
        bannerURL: bannerUrl,
      })
    }
  }

  if (avatarResponse && avatarStream) {
    const ext = extensionFromFilename(avatarResponse.filename as string)
    const fileName = ext ? profile.url + '.' + ext : profile.url
    const avatarUrl = await uploadStreamToS3(fileName, s3config, avatarStream)
    if (avatarUrl) {
      // if user does not want to composite image with profile url, we just save image to photoURL
      if (!compositeProfileURL) {
        await repositories.profile.updateOneById(profileId, {
          photoURL: avatarUrl,
        })
      }
      // else, we will create composite image
      else {
        const compositeUrl = await generateCompositeImage(profile.url, avatarUrl)
        if (compositeUrl) {
          await repositories.profile.updateOneById(profileId, {
            photoURL: compositeUrl,
          })
        }
      }
    }
  }

  if (description) {
    await repositories.profile.updateOneById(profileId, { description: description })
  }

  profile = await repositories.profile.findById(profileId)
  return profile
}

const createCompositeImage = async (
  _: any,
  args: gql.MutationCreateCompositeImageArgs,
  ctx: Context,
): Promise<gql.Profile> => {
  const { repositories } = ctx
  const { profileId } = args.input
  let profile = await repositories.profile.findById(profileId)
  if (!profile) {
    return Promise.reject(appError.buildNotFound(
      profileError.buildProfileNotFoundMsg(profileId),
      profileError.ErrorType.ProfileNotFound,
    ))
  }

  const imageURL = await generateCompositeImage(profile.url, DEFAULT_NFT_IMAGE)
  profile = await repositories.profile.updateOneById(profileId, {
    photoURL: imageURL,
  })
  return profile
}

const sortedProfilesByVisibleNFTs = async (
  repositories: db.Repository,
  args: gql.QueryLatestProfilesArgs,
  chainId: string,
): Promise<gql.ProfilesOutput> => {
  const key = `${CacheKeys.SORTED_PROFILES_BY_VISIBLE_NFTS}_${chainId}`
  const cachedData = await cache.get(key)
  let indexedProfiles: Array<gql.Profile> = []
  if (cachedData) {
    indexedProfiles = JSON.parse(cachedData)
  } else {
    const profiles = await repositories.profile.find({  where: { chainId }, order: { visibleNFTs: 'DESC' } })
    for (let i = 0; i < profiles.length; i++) {
      indexedProfiles.push({
        index: i,
        ...profiles[i],
      })
    }
    await cache.set(key, JSON.stringify(indexedProfiles), 'EX', 60 * 10)
  }

  const { pageInput } = helper.safeObject(args?.input)
  let paginatedProfiles: Array<gql.Profile>
  let defaultCursor
  if (!pagination.hasAfter(pageInput) && !pagination.hasBefore(pageInput)) {
    defaultCursor = pagination.hasFirst(pageInput) ? { beforeCursor: '-1' } :
      { afterCursor: indexedProfiles.length.toString() }
  }

  const safePageInput = safeInput(pageInput, defaultCursor)

  let totalItems
  if (pagination.hasFirst(safePageInput)) {
    const cursor = pagination.hasAfter(safePageInput) ?
      safePageInput.afterCursor : safePageInput.beforeCursor
    paginatedProfiles = indexedProfiles.filter((profile) => profile.index > Number(cursor))
    totalItems = paginatedProfiles.length
    paginatedProfiles = paginatedProfiles.slice(0, safePageInput.first)
  } else {
    const cursor = pagination.hasAfter(safePageInput) ?
      safePageInput.afterCursor : safePageInput.beforeCursor
    paginatedProfiles = indexedProfiles.filter((profile) => profile.index < Number(cursor))
    totalItems = paginatedProfiles.length
    paginatedProfiles =
      paginatedProfiles.slice(paginatedProfiles.length - safePageInput.last)
  }

  return pagination.toPageable(
    pageInput,
    paginatedProfiles[0],
    paginatedProfiles[paginatedProfiles.length - 1],
    'index',
  )([paginatedProfiles, totalItems])
}

const getLatestProfiles = async (
  _: any,
  args: gql.QueryLatestProfilesArgs,
  ctx: Context,
): Promise<gql.ProfilesOutput> => {
  const { repositories } = ctx
  logger.debug('getLatestProfiles', { input: args?.input })
  const chainId = args?.input.chainId || process.env.CHAIN_ID
  auth.verifyAndGetNetworkChain('ethereum', chainId)

  const pageInput = args?.input.pageInput
  const inputFilters = {
    pageInput: args?.input?.pageInput,
    chainId: chainId,
  }
  const filters = [helper.inputT2SafeK(inputFilters)]
  if (args?.input.sortBy === gql.ProfileSortType.RecentUpdated) {
    return core.paginatedEntitiesBy(
      repositories.profile,
      pageInput,
      filters,
      [],
      'updatedAt',
      'DESC',
    )
      .then(pagination.toPageable(pageInput, null, null, 'updatedAt'))
  } else if (args?.input.sortBy === gql.ProfileSortType.RecentMinted) {
    return core.paginatedEntitiesBy(
      repositories.profile,
      pageInput,
      filters,
      [],
      'createdAt',
      'DESC',
    )
      .then(pagination.toPageable(pageInput, null, null, 'createdAt'))
  } else if (args?.input.sortBy === gql.ProfileSortType.MostVisibleNFTs) {
    return await sortedProfilesByVisibleNFTs(repositories, args, chainId)
  } else {
    return core.paginatedEntitiesBy(
      repositories.profile,
      pageInput,
      filters,
      [],
      'updatedAt',
      'DESC',
    )
      .then(pagination.toPageable(pageInput, null, null, 'updatedAt'))
  }
}

const orderingUpdates = (
  _: any,
  args: gql.MutationOrderingUpdatesArgs,
  ctx: Context,
): Promise<gql.Profile> => {
  const { repositories, user } = ctx
  logger.debug('orderingUpdates', { input: args?.input })

  const notOwner = (p: entity.Profile): boolean => p.ownerUserId !== user.id
  const { profileId, updates } = args.input

  return getProfile(profileId, repositories.profile.findById)
    .then(fp.rejectIf(notOwner)(appError.buildForbidden(
      profileError.buildProfileNotOwnedMsg(profileId),
      profileError.ErrorType.ProfileNotOwned,
    )))
    .then(fp.tapWait((profile) => updateNFTsOrder(profile.id, updates)))
}

const collectInfoFromScore = (score: string): LeaderboardInfo => {
  /*
    If score length is less than 5 or equal to 5, edge count and collection count will be zero
    And gk count will be score
   */
  if (score.length <= 5) {
    return {
      gkCount: Number(score),
      edgeCount: 0,
      collectionCount: 0,
    }
  } else if (score.length <= 10) {
    /*
      If score length is greater than 5 and less than 10 or equal to 10, edge count will be 0
      i.e. 1000025 -> gkCount = 25, edgeCount = 0, collectionCount = 10
     */
    return {
      gkCount: Number(score.slice(score.length - 5, score.length)),
      edgeCount: 0,
      collectionCount: Number(score.slice(0, score.length - 5)),
    }
  } else {
    /*
      If score length is greater than 10
      i.e. 60000000005 -> edgeCount = 6, collectionCount = 0, gK = 5
     */
    return {
      gkCount: Number(score.slice(score.length - 5, score.length)),
      edgeCount: Number(score.slice(0, score.length - 10)),
      collectionCount: Number(score.slice(score.length - 10, score.length - 5)),
    }
  }
}

const leaderboard = async (
  _: any,
  args: gql.QueryLeaderboardArgs,
  ctx: Context,
): Promise<gql.LeaderboardOutput> => {
  const { repositories } = ctx
  const chainId = args?.input.chainId || process.env.CHAIN_ID
  auth.verifyAndGetNetworkChain('ethereum', chainId)

  const TOP = args?.input.count ? Number(args?.input.count) : 100
  const cacheKey = `${CacheKeys.LEADERBOARD_RESPONSE}_${chainId}_top_${TOP}`
  const cachedData = await cache.get(cacheKey)
  let leaderboard: Array<gql.LeaderboardProfile> = []

  // if cached data is not null and not an empty array
  if (cachedData?.length) {
    leaderboard = JSON.parse(cachedData)
  } else {
    const profilesWithScore = await cache.zrevrangebyscore(`LEADERBOARD_${chainId}`, '+inf', '-inf', 'WITHSCORES')

    let index = 0
    // get leaderboard for TOP items...
    const length = profilesWithScore.length >= TOP * 2 ? TOP * 2 : profilesWithScore.length
    for (let i = 0; i < length - 1; i+= 2) {
      const profileId = profilesWithScore[i]
      const collectionInfo = collectInfoFromScore(profilesWithScore[i + 1])
      const profile = await repositories.profile.findOne({ where: { id: profileId } })
      leaderboard.push({
        index: index,
        id: profileId,
        itemsVisible: collectionInfo.edgeCount,
        numberOfGenesisKeys: collectionInfo.gkCount,
        numberOfCollections: collectionInfo.collectionCount,
        photoURL: profile.photoURL,
        url: profile.url,
      })
      index++
    }
    await cache.set(
      cacheKey,
      JSON.stringify(leaderboard),
      'EX',
      5 * 60, // 5 minutes
    )
  }

  const { pageInput } = helper.safeObject(args?.input)
  let paginatedLeaderboard: Array<gql.LeaderboardProfile>
  let defaultCursor
  if (!pagination.hasAfter(pageInput) && !pagination.hasBefore(pageInput)) {
    defaultCursor = pagination.hasFirst(pageInput) ? { beforeCursor: '-1' } :
      { afterCursor: leaderboard.length.toString() }
  }

  const safePageInput = safeInput(pageInput, defaultCursor)

  let totalItems
  if (pagination.hasFirst(safePageInput)) {
    const cursor = pagination.hasAfter(safePageInput) ?
      safePageInput.afterCursor : safePageInput.beforeCursor
    paginatedLeaderboard = leaderboard.filter((leader) => leader.index > Number(cursor))
    totalItems = paginatedLeaderboard.length
    paginatedLeaderboard = paginatedLeaderboard.slice(0, safePageInput.first)
  } else {
    const cursor = pagination.hasAfter(safePageInput) ?
      safePageInput.afterCursor : safePageInput.beforeCursor
    paginatedLeaderboard = leaderboard.filter((leader) => leader.index < Number(cursor))
    totalItems = paginatedLeaderboard.length
    paginatedLeaderboard =
      paginatedLeaderboard.slice(paginatedLeaderboard.length - safePageInput.last)
  }

  return pagination.toPageable(
    pageInput,
    paginatedLeaderboard[0],
    paginatedLeaderboard[paginatedLeaderboard.length - 1],
    'index',
  )([paginatedLeaderboard, totalItems])
}

const saveScoreForProfiles = async (
  _: any,
  args: gql.MutationSaveScoreForProfilesArgs,
  ctx: Context,
): Promise<gql.SaveScoreForProfilesOutput> => {
  const { repositories } = ctx
  logger.debug('saveScoreForProfiles', { input: args?.input })
  try {
    const count = Number(args?.input.count) > 1000 ? 1000 : Number(args?.input.count)
    const profiles = await repositories.profile.find(args?.input.nullOnly ? {
      where: {
        lastScored: null,
      },
    } : {
      order: {
        lastScored: 'ASC',
      },
    })
    const slicedProfiles = profiles.slice(0, count)
    await Promise.allSettled(
      slicedProfiles.map(async (profile) => {
        await saveProfileScore(repositories, profile)
        const now = helper.toUTCDate()
        await repositories.profile.updateOneById(profile.id, {
          lastScored: now,
        })
        logger.debug(`Score is cached for Profile ${ profile.id }`)
      }),
    )
    logger.debug('Profile scores are cached', { counts: slicedProfiles.length })
    return {
      message: 'Saved score for profiles',
    }
  } catch (err) {
    Sentry.captureMessage(`Error in saveScoreForProfiles Job: ${err}`)
    return err
  }
}

const clearGKIconVisible = async (
  _: any,
  args: any,
  ctx: Context,
): Promise<gql.ClearGkIconVisibleOutput> => {
  try {
    const { repositories, chain } = ctx
    const chainId = chain.id || process.env.CHAIN_ID
    auth.verifyAndGetNetworkChain('ethereum', chainId)
    const owners = await getOwnersOfGenesisKeys(chainId)
    const ownerWalletIds: string[] = []
    await Promise.allSettled(
      owners.map(async (owner) => {
        const foundWallet: entity.Wallet = await repositories.wallet.findByChainAddress(
          chainId,
          ethers.utils.getAddress(owner),
        )
        ownerWalletIds.push(foundWallet.id)
      }),
    )
    const profiles = await repositories.profile.find({ where: { chainId } })
    const updatedProfiles = []
    profiles.map((profile) => {
      if (ownerWalletIds.findIndex((id) => id === profile.ownerWalletId) === -1) {
        if (profile.gkIconVisible) {
          profile.gkIconVisible = false
          updatedProfiles.push(profile)
        }
      }
    })
    if (updatedProfiles.length) {
      await repositories.profile.saveMany(updatedProfiles, { chunk: MAX_SAVE_COUNTS })
      return {
        message: `Cleared GK icon visible for ${updatedProfiles.length} profiles`,
      }
    } else {
      return {
        message: 'No need to clear GK icon visible for profiles',
      }
    }
  } catch (err) {
    Sentry.captureMessage(`Error in clearGKIconVisible: ${err}`)
    return err
  }
}

const updateProfileView = async (
  _: any,
  args: gql.MutationUpdateProfileViewArgs,
  ctx: Context,
): Promise<gql.Profile> => {
  try {
    const { repositories, user, chain } = ctx
    const chainId = chain.id || process.env.CHAIN_ID
    auth.verifyAndGetNetworkChain('ethereum', chainId)
    logger.debug('updateProfileView', { loggedInUserId: user.id, input: args?.input })
    const { url, profileViewType } = helper.safeObject(args?.input)
    const profile = await repositories.profile.findOne({ where: { url, chainId } })
    if (!profile) {
      return Promise.reject(appError.buildNotFound(
        profileError.buildProfileUrlNotFoundMsg(url, chainId),
        profileError.ErrorType.ProfileNotFound,
      ))
    } else {
      if (profile.ownerUserId !== user.id) {
        return Promise.reject(appError.buildForbidden(
          profileError.buildProfileNotOwnedMsg(profile.id),
          profileError.ErrorType.ProfileNotOwned,
        ))
      } else {
        return await repositories.profile.updateOneById(profile.id,
          { profileView: profileViewType },
        )
      }
    }
  } catch (err) {
    Sentry.captureMessage(`Error in updateProfileView: ${err}`)
    return err
  }
}

const saveNFTVisibility = async (
  _: any,
  args: gql.MutationSaveNFTVisibilityForProfilesArgs,
  ctx: Context,
): Promise<gql.SaveNFTVisibilityForProfilesOutput> => {
  const { repositories, chain } = ctx
  const chainId = chain.id || process.env.CHAIN_ID
  auth.verifyAndGetNetworkChain('ethereum', chainId)
  logger.debug('saveNFTVisibility', { count: args?.count })
  try {
    const count = Number(args?.count) > 1000 ? 1000 : Number(args?.count)
    const profiles = await repositories.profile.find({ where: { visibleNFTs: 0, chainId } })
    const slicedProfiles = profiles.slice(0, count)
    await Promise.allSettled(
      slicedProfiles.map(async (profile) => {
        await saveVisibleNFTsForProfile(profile.id, repositories)
      }),
    )
    logger.debug('Amount of visible NFTs for profiles are cached', { counts: slicedProfiles.length })
    return {
      message: `Saved amount of visible NFTs for ${slicedProfiles.length} profiles`,
    }
  } catch (err) {
    Sentry.captureMessage(`Error in saveNFTVisibility: ${err}`)
    return err
  }
}

const getIgnoredEvents = async (
  _: any,
  args: gql.QueryIgnoredEventsArgs,
  ctx: Context,
): Promise<entity.Event[]> => {
  try {
    const { repositories } = ctx
    const chainId = args?.input.chainId || process.env.CHAIN_ID
    auth.verifyAndGetNetworkChain('ethereum', chainId)
    logger.debug('getIgnoredEvents', { input: args?.input })
    const { profileUrl, walletAddress } = helper.safeObject(args?.input)
    return await repositories.event.find({
      where: {
        profileUrl,
        ownerAddress: ethers.utils.getAddress(walletAddress),
        ignore: true,
      },
    })
  } catch (err) {
    Sentry.captureMessage(`Error in getIgnoredEvents: ${err}`)
    return err
  }
}

const getAssociatedCollectionForProfile = async (
  _: any,
  args: gql.QueryAssociatedCollectionForProfileArgs,
  ctx: Context,
): Promise<gql.CollectionInfo> => {
  try {
    const { repositories } = ctx
    const chainId = args?.chainId || process.env.CHAIN_ID
    auth.verifyAndGetNetworkChain('ethereum', chainId)
    logger.debug('getAssociatedCollectionForProfile', { profileUrl: args?.url })
    const profile = await repositories.profile.findOne({ where: { url: args?.url, chainId } })
    if (!profile) {
      return Promise.reject(appError.buildNotFound(
        profileError.buildProfileUrlNotFoundMsg(args?.url, chainId),
        profileError.ErrorType.ProfileNotFound,
      ))
    }
    if (profile.profileView === defs.ProfileViewType.Collection) {
      if (profile.associatedContract) {
        return await getCollectionInfo(profile.associatedContract, chainId, repositories)
      } else {
        return Promise.reject(appError.buildNotFound(
          profileError.buildAssociatedContractNotFoundMsg(args?.url, chainId),
          profileError.ErrorType.ProfileAssociatedContractNotFoundMsg,
        ))
      }
    } else {
      return Promise.reject(appError.buildNotFound(
        profileError.buildProfileViewTypeWrong(),
        profileError.ErrorType.ProfileViewTypeWrong,
      ))
    }
  } catch (err) {
    Sentry.captureMessage(`Error in getAssociatedCollectionForProfile: ${err}`)
    return err
  }
}

const isProfileCustomized = async (
  _: any,
  args: gql.QueryIsProfileCustomizedArgs,
  ctx: Context,
): Promise<boolean> => {
  try {
    const { repositories } = ctx
    const chainId = args?.chainId || process.env.CHAIN_ID
    auth.verifyAndGetNetworkChain('ethereum', chainId)
    logger.debug('isProfileCustomized', { profileUrl: args?.url })
    const profile = await repositories.profile.findOne({ where: { url: args?.url, chainId } })
    if (!profile) {
      return Promise.reject(appError.buildNotFound(
        profileError.buildProfileUrlNotFoundMsg(args?.url, chainId),
        profileError.ErrorType.ProfileNotFound,
      ))
    }
    const edges = await repositories.edge.find({
      where: {
        thisEntityId: profile.id,
        thisEntityType: defs.EntityType.Profile,
        thatEntityType: defs.EntityType.NFT,
        edgeType: defs.EdgeType.Displays,
        hide: false,
      },
    })
    return !!edges.length
  } catch (err) {
    Sentry.captureMessage(`Error in isProfileCustomized: ${err}`)
    return err
  }
}

export default {
  Upload: GraphQLUpload,
  Query: {
    profile: getProfileByURL,
    profilePassive: getProfileByURLPassive,
    myProfiles: combineResolvers(auth.isAuthenticated, getMyProfiles),
    profileFollowers: getProfileFollowers,
    profilesFollowedByMe: combineResolvers(auth.isAuthenticated, getProfilesFollowedByMe),
    blockedProfileURI: getBlockedProfileURI,
    insiderReservedProfiles: combineResolvers(auth.isAuthenticated, getInsiderReservedProfileURIs),
    latestProfiles: getLatestProfiles,
    leaderboard: leaderboard,
    ignoredEvents: getIgnoredEvents,
    associatedCollectionForProfile: getAssociatedCollectionForProfile,
    isProfileCustomized: isProfileCustomized,
  },
  Mutation: {
    followProfile: combineResolvers(auth.isAuthenticated, followProfile),
    unfollowProfile: combineResolvers(auth.isAuthenticated, unfollowProfile),
    updateProfile: combineResolvers(auth.isAuthenticated, updateProfile),
    profileClaimed: combineResolvers(auth.isAuthenticated, profileClaimed),
    uploadProfileImages: combineResolvers(auth.isAuthenticated, uploadProfileImages),
    createCompositeImage: combineResolvers(auth.isAuthenticated, createCompositeImage),
    orderingUpdates: combineResolvers(auth.isAuthenticated, orderingUpdates),
    saveScoreForProfiles: combineResolvers(auth.isAuthenticated, saveScoreForProfiles),
    clearGKIconVisible: combineResolvers(auth.isAuthenticated, clearGKIconVisible),
    updateProfileView: combineResolvers(auth.isAuthenticated, updateProfileView),
    saveNFTVisibilityForProfiles: combineResolvers(auth.isAuthenticated, saveNFTVisibility),
  },
  Profile: {
    followersCount: getFollowersCount,
    owner: core.resolveEntityById<gql.Profile, entity.Wallet>(
      'ownerWalletId',
      defs.EntityType.Profile,
      defs.EntityType.Wallet,
    ),
    isOwnedByMe: core.resolveEntityOwnership<gql.Profile>(
      'ownerUserId',
      'user',
      defs.EntityType.Profile,
    ),
    isFollowedByMe: core.resolveEdgeOwnership<gql.Profile>(
      'wallet',
      defs.EdgeType.Follows,
    ),
    winningBid: getWinningBid,
  },
}
