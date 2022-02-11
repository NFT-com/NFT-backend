import { BigNumber, ContractReceipt, ContractTransaction, utils, Wallet } from 'ethers'
import { combineResolvers } from 'graphql-resolvers'
import Joi from 'joi'

import { Context, gql } from '@nftcom/gql/defs'
import { appError, mintError, profileError } from '@nftcom/gql/error'
import { auth, joi } from '@nftcom/gql/helper'
import { core } from '@nftcom/gql/service'
import { _logger, contracts, defs, entity, fp, helper, provider, typechain } from '@nftcom/shared'

const logger = _logger.Factory(_logger.Context.Profile, _logger.Context.GraphQL)

const toProfilesOutput = (profiles: entity.Profile[]): gql.ProfilesOutput => ({
  items: profiles,
  pageInfo: null,
  totalItems: profiles.length,
})

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
  const { user, wallet, repositories } = ctx
  logger.debug('followProfile', { loggedInUserId: user.id, input: args, wallet })

  const schema = Joi.object().keys({ url: Joi.string() })
  joi.validateSchema(schema, args)

  const { url } = args
  return repositories.profile.findByURL(url)
    .then(fp.thruIfEmpty(() => core.createProfile(ctx, { url })))
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

const getProfileByURL = (
  _: any,
  args: gql.QueryProfileArgs,
  ctx: Context,
): Promise<gql.Profile> => {
  const { user, repositories } = ctx
  logger.debug('getProfileByURL', { loggedInUserId: user?.id, input: args })
  const schema = Joi.object().keys({
    url: Joi.string().required(),
  })
  joi.validateSchema(schema, args)
  return repositories.profile.findByURL(args.url)
    .then(fp.thruIfEmpty(() => core.createProfile(ctx, { url: args.url })))
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
  const { user, repositories } = ctx
  logger.debug('updateProfile', { loggedInUserId: user.id, input: args.input })

  const schema = Joi.object().keys({
    id: Joi.string().required(),
    bannerURL: Joi.string().uri().allow(null),
    description: Joi.string().allow(null),
    photoURL: Joi.string().uri().allow(null),
  })
  joi.validateSchema(schema, args.input)

  const notOwner = (p: entity.Profile): boolean => p.ownerUserId !== user.id
  const { id } = args.input

  return getProfile(id, repositories.profile.findById)
    .then(fp.rejectIf(notOwner)(appError.buildForbidden(
      profileError.buildProfileNotOwnedMsg(id),
      profileError.ErrorType.ProfileNotOwned,
    )))
    .then((p) => {
      p.bannerURL = args.input.bannerURL || p.bannerURL
      p.description = args.input.description || p.description
      p.photoURL = args.input.photoURL || p.photoURL
      return repositories.profile.save(p)
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
      return repositories.profile.save(profile)
    })
}

const mintGKProfile = (
  _: any,
  args: gql.MutationMintGkProfileArgs,
  ctx: Context,
): Promise<string> => {
  const { repositories, wallet } = ctx
  const { startIndex, count } = args.input
  logger.debug('mintGKProfile', { startIndex, count })
  const signer = Wallet.fromMnemonic(contracts.getProfileAuctionMnemonic(wallet.chainId))
    .connect(provider.provider(Number(wallet.chainId)))
  const genesisKeyContract = typechain.GenesisKey__factory.connect(
    contracts.genesisKeyAddress(wallet.chainId),
    signer,
  )
  const profileAuctionContract = typechain.ProfileAuction__factory.connect(
    contracts.profileAuctionAddress(wallet.chainId),
    signer,
  )
  return new Promise(() => {
    const mintArgs = []
    const executedBids = []
    const givenProfiles = []
    const givenProfileURIs = []
    Array.apply(0, Array(count)).map((z, index) => index + startIndex)
      .forEach((tokenIndex: number) => {
        genesisKeyContract.ownerOf(BigNumber.from(tokenIndex))
          .then((address: string) => {
            repositories.wallet.findOne({ where: { address, network: 'ethereum', chainId: wallet.chainId } })
              .then(fp.thruIfNotEmpty((bidderWallet: entity.Wallet) => {
                return Promise.all([
                  repositories.bid.find({
                    where: {
                      walletId: bidderWallet.id,
                      nftType: defs.NFTType.GenesisKeyProfile,
                    },
                    order: { price: 'DESC' },
                  }),
                  Promise.resolve(bidderWallet),
                ])
              }))
              .then(fp.thruIfNotEmpty(([prefs, bidderWallet] : [entity.Bid[], entity.Wallet]) => {
                prefs.forEach((bid: entity.Bid) => {
                  repositories.profile.findById(bid.profileId)
                    .then((profile: entity.Profile) =>
                      Promise.all([
                        Promise.resolve(profile),
                        Promise.resolve(bidderWallet),
                      ]))
                    .then(([profile, bidderWallet]: [entity.Profile, entity.Wallet]) => {
                      if (
                        profile.status === defs.ProfileStatus.Available &&
                        !givenProfileURIs.includes(profile.url)
                      ) {
                        mintArgs.push({
                          v: bid.signature.v,
                          r: bid.signature.r,
                          s: bid.signature.s,
                          _profileURI: profile.url,
                          _owner: bidderWallet.address,
                          _genKey: true,
                      
                          _nftTokens: BigNumber.from(0),
                          nftV: BigNumber.from(0),
                          nftR: bid.signature.r,
                          nftS: bid.signature.s,
                        })
                        executedBids.push(bid)
                        givenProfiles.push(profile)
                        givenProfileURIs.push(profile.url)
                      }
                    })
                })
              }))
          })
      })

    logger.debug('mintGKProfile transaction args: ', mintArgs)

    return contracts.getEthGasInfo(Number(wallet.chainId))
      .then((egs) => profileAuctionContract.mintProfileFor(mintArgs, egs))
      .then((tx: ContractTransaction) => tx.wait(1))
      .then((receipt: ContractReceipt) => receipt.transactionHash)
      .then(fp.tap(() => {
        Promise.all([
          ...executedBids.map((bid: entity.Bid) =>
            repositories.bid.save({ ...bid, status: defs.BidStatus.Executed })),
          ...givenProfiles.map((profile: entity.Profile) =>
            repositories.profile.save({ ...profile, status: defs.ProfileStatus.Pending })),
        ])
      }))
  })
}

export default {
  Query: {
    profile: getProfileByURL,
    myProfiles: combineResolvers(auth.isAuthenticated, getMyProfiles),
    profileFollowers: getProfileFollowers,
    profilesFollowedByMe: combineResolvers(auth.isAuthenticated, getProfilesFollowedByMe),
  },
  Mutation: {
    followProfile: combineResolvers(auth.isAuthenticated, followProfile),
    unfollowProfile: combineResolvers(auth.isAuthenticated, unfollowProfile),
    updateProfile: combineResolvers(auth.isAuthenticated, updateProfile),
    profileClaimed: combineResolvers(auth.isAuthenticated, profileClaimed),
    mintGKProfile: combineResolvers(auth.isTeamAuthenticated, mintGKProfile),
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
