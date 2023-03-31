import axios from 'axios'
import cryptoRandomString from 'crypto-random-string'
import { addDays } from 'date-fns'
import { utils } from 'ethers'
import { combineResolvers } from 'graphql-resolvers'
import Joi from 'joi'

import { cache, CacheKeys } from '@nftcom/cache'
import { appError, mintError, userError, walletError } from '@nftcom/error-types'
import { Context, gql } from '@nftcom/gql/defs'
import { auth, joi } from '@nftcom/gql/helper'
import { obliterateQueue } from '@nftcom/gql/job/job'
import { core, sendgrid } from '@nftcom/gql/service'
import { profileActionType } from '@nftcom/gql/service/core.service'
import { _logger, contracts, defs, entity, fp, helper, provider, typechain } from '@nftcom/shared'
import * as Sentry from '@sentry/node'

const logger = _logger.Factory(_logger.Context.User, _logger.Context.GraphQL)

const signUp = (_: any, args: gql.MutationSignUpArgs, ctx: Context): Promise<gql.User> => {
  const { repositories } = ctx
  logger.debug('signUp', { input: args.input })

  const schema = Joi.object().keys({
    avatarURL: Joi.string(),
    email: Joi.string().email(),
    username: Joi.string(),
    referredBy: Joi.string().optional(),
    referredUrl: Joi.string().optional(),
    referralId: Joi.string().optional(),
    wallet: joi.buildWalletInputSchema(),
  })
  joi.validateSchema(schema, args.input)

  const { email, username, avatarURL, referredBy = '', wallet, referredUrl, referralId } = args.input
  const { address, network, chainId } = wallet
  const chain = auth.verifyAndGetNetworkChain(network, chainId)

  return Promise.all([
    repositories.user.exists({ username, email }),
    repositories.wallet.exists({ network, chainId, address }),
  ])
    .then(([userExists, addressExists]) => {
      if (userExists) {
        return Promise.reject(
          appError.buildExists(userError.buildUsernameExistsMsg(username), userError.ErrorType.UsernameAlreadyExists),
        )
      }
      if (addressExists) {
        return Promise.reject(
          appError.buildExists(
            walletError.buildAddressExistsMsg(network, chain, address),
            walletError.ErrorType.AddressAlreadyExists,
          ),
        )
      }
      return referredBy
    })
    .then(
      fp.thruIfNotEmpty((refId: string) => {
        return repositories.user.findByReferralId(refId).then(user => user?.id)
      }),
    )
    .then((referredUserId: string) => {
      let referredInfo
      if (!referredUserId || !referredUserId.length) {
        referredInfo = null
      } else {
        referredInfo = referredBy
        if (referredUrl && referredUrl.length) {
          referredInfo = referredInfo + '::' + referredUrl
        }
      }
      // if referralId is existing in variable, it means we don't need to create new user because it's referred by someone from our platform
      if (referralId && referralId.length) {
        return repositories.user.findByReferralId(referralId).then(existingUser => {
          if (existingUser) {
            return repositories.user.updateOneById(existingUser.id, {
              username,
              referredBy: referredInfo || null,
              avatarURL,
              isEmailConfirmed: true,
              confirmEmailToken: null,
              confirmEmailTokenExpiresAt: null,
            })
          } else {
            return Promise.reject(
              appError.buildInvalid(
                userError.buildInvalidReferralId(referralId),
                userError.ErrorType.InvalidReferralId,
              ),
            )
          }
        })
      } else {
        const confirmEmailToken = cryptoRandomString({ length: 36, type: 'url-safe' })
        const confirmEmailTokenExpiresAt = addDays(helper.toUTCDate(), 1)
        const newReferralId = cryptoRandomString({ length: 10, type: 'url-safe' })
        return repositories.user.save({
          email,
          username,
          referredBy: referredInfo || null,
          avatarURL,
          confirmEmailToken,
          confirmEmailTokenExpiresAt,
          referralId: newReferralId,
        })
      }
    })
    .then(
      fp.tapWait<entity.User, unknown>(user =>
        Promise.all([
          repositories.wallet.save({
            userId: user.id,
            network,
            chainId: chain.id,
            chainName: chain.name,
            address,
          }),
          sendgrid.sendEmailVerificationCode(user),
        ]),
      ),
    )
}

const updateEmail = (_: any, args: gql.MutationSignUpArgs, ctx: Context): Promise<entity.User> => {
  const { user, repositories } = ctx
  logger.debug('updateEmail', { input: args.input })

  const schema = Joi.object().keys({
    email: Joi.string().email().required(),
  })
  joi.validateSchema(schema, args.input)

  const { email } = args.input

  const confirmEmailToken = cryptoRandomString({ length: 36, type: 'url-safe' })
  const confirmEmailTokenExpiresAt = addDays(helper.toUTCDate(), 1)
  return repositories.user
    .save({
      ...user,
      email,
      confirmEmailToken,
      confirmEmailTokenExpiresAt,
    })
    .then(fp.tapWait(sendgrid.sendEmailVerificationCode))
}

const updateReferral = (ctx: Context) => {
  return (otherUser: entity.User): Promise<boolean> => {
    const { user } = ctx
    return core
      .createEdge(ctx, {
        thisEntityId: otherUser.id,
        thisEntityType: defs.EntityType.User,
        thatEntityId: user.id,
        thatEntityType: defs.EntityType.User,
        edgeType: defs.EdgeType.Referred,
      })
      .then(() =>
        core.countEdges(ctx, {
          thisEntityId: otherUser.id,
          edgeType: defs.EdgeType.Referred,
        }),
      )
      .then(count => sendgrid.sendReferredBy(otherUser, count))
  }
}

const confirmEmail = (_: any, args: gql.MutationConfirmEmailArgs, ctx: Context): Promise<boolean> => {
  logger.debug('confirmEmail', { input: args })
  const { repositories } = ctx

  const schema = Joi.object().keys({
    token: Joi.string().required(),
  })
  joi.validateSchema(schema, args)

  const { token } = args
  const invalidTokenError = appError.buildInvalid(
    userError.buildInvalidEmailTokenMsg(token),
    userError.ErrorType.InvalidEmailConfirmToken,
  )
  return repositories.user
    .findByEmailConfirmationToken(token)
    .then(fp.rejectIfEmpty(invalidTokenError))
    .then(user =>
      repositories.user.save({
        ...user,
        isEmailConfirmed: true,
        confirmEmailToken: null,
        confirmEmailTokenExpiresAt: null,
      }),
    )
    .then(user => {
      if (helper.isEmpty(user.referredBy)) {
        return user
      }
      const referredUserId = user.referredBy.split('::')[0]
      return repositories.user.findById(referredUserId).then(fp.tap(updateReferral(ctx)))
    })
    .then(() => true)
}

const buildPreferencesInputSchema = (): Joi.ObjectSchema =>
  Joi.object().keys({
    bidActivityNotifications: Joi.boolean().required(),
    priceChangeNotifications: Joi.boolean().required(),
    outbidNotifications: Joi.boolean().required(),
    purchaseSuccessNotifications: Joi.boolean().required(),
    promotionalNotifications: Joi.boolean().required(),
  })

const updateMe = (_: any, args: gql.MutationUpdateMeArgs, ctx: Context): Promise<gql.User> => {
  const { user, repositories } = ctx
  logger.debug('updateMe', { loggedInUserId: user.id, input: args.input })

  const schema = Joi.object().keys({
    avatarURL: Joi.string(),
    email: Joi.string().email(),
    preferences: buildPreferencesInputSchema(),
  })

  joi.validateSchema(schema, args.input)

  const { avatarURL = user.avatarURL, preferences = user.preferences, email } = args.input
  return repositories.user.updateOneById(user.id, { avatarURL, preferences }).then(user => {
    if (email.length && email !== user.email) {
      return core.sendEmailVerificationCode(email, user, repositories).then(() => user)
    } else if (email === user.email) {
      // if token is expired...
      if (!user.isEmailConfirmed && new Date(user.confirmEmailTokenExpiresAt) <= new Date()) {
        return core.sendEmailVerificationCode(email, user, repositories).then(() => user)
      } else {
        return user
      }
    } else {
      return user
    }
  })
}

const resendEmailConfirm = (_: any, args: any, ctx: Context): Promise<entity.User> => {
  const { user, repositories } = ctx
  logger.debug('resendEmailConfirm', { loggedInUserId: user.id })
  const confirmEmailToken = cryptoRandomString({ length: 36, type: 'url-safe' })
  const confirmEmailTokenExpiresAt = addDays(helper.toUTCDate(), 1)
  return repositories.user
    .save({
      ...user,
      confirmEmailToken,
      confirmEmailTokenExpiresAt,
    })
    .then(fp.tapWait(sendgrid.sendEmailVerificationCode))
}

const getMyAddresses = (parent: gql.User, _: unknown, ctx: Context): Promise<gql.Wallet[]> => {
  const { user, repositories } = ctx
  logger.debug('getMyAddresses', { userId: parent.id, loggedInUserId: user.id })
  if (user.id !== parent.id) {
    return null
  }
  return repositories.wallet.findByUserId(parent.id)
}

const ignoreAssociations = (
  _: any,
  args: gql.MutationIgnoreAssociationsArgs,
  ctx: Context,
): Array<Promise<entity.Event>> => {
  const { user, repositories, chain, wallet } = ctx
  const chainId = chain.id || process.env.CHAIN_ID
  auth.verifyAndGetNetworkChain('ethereum', chainId)
  logger.debug('ignoreAssocations', { loggedInUserId: user.id, wallet: wallet.address, args: args?.eventIdArray })

  return args?.eventIdArray.map(e =>
    repositories.event
      .findOne({
        where: {
          id: e,
          destinationAddress: helper.checkSum(wallet.address),
        },
      })
      .then(e => {
        if (e) {
          return repositories.event.save({ ...e, ignore: true })
        } else {
          return Promise.reject(
            appError.buildForbidden(
              userError.buildForbiddenActionMsg(' event id doesn\'t exist under your user'),
              userError.ErrorType.ForbiddenAction,
            ),
          )
        }
      }),
  )
}

const getMyPendingAssociations = async (
  _: any,
  args: unknown,
  ctx: Context,
): Promise<Array<gql.PendingAssociationOutput>> => {
  const { user, repositories, wallet, chain } = ctx
  const chainId = chain.id || process.env.CHAIN_ID
  auth.verifyAndGetNetworkChain('ethereum', chainId)
  logger.debug('getMyPendingAssocations', { loggedInUserId: user.id, wallet: wallet.address })

  const matches = await repositories.event.find({
    where: {
      eventName: 'AssociateEvmUser',
      destinationAddress: helper.checkSum(wallet.address),
      chainId: wallet.chainId,
      ignore: false,
    },
    order: {
      blockNumber: 'ASC',
    },
  })

  const clearAlls = await repositories.event.find({
    where: {
      eventName: 'ClearAllAssociatedAddresses',
      chainId: wallet.chainId,
    },
    order: {
      blockNumber: 'ASC',
    },
  })

  const clearAllLatestMap = {}
  for (let i = 0; i < clearAlls.length; i++) {
    const o = clearAlls[i]
    const key = `${o.chainId}_${o.ownerAddress}_${o.profileUrl}`
    if (clearAllLatestMap[key]) {
      clearAllLatestMap[key] = Math.max(clearAllLatestMap[key], o.blockNumber)
    } else {
      clearAllLatestMap[key] = o.blockNumber
    }
  }

  const cancellations = await repositories.event.find({
    where: {
      eventName: 'CancelledEvmAssociation',
      destinationAddress: helper.checkSum(wallet.address),
      chainId: wallet.chainId,
    },
    order: {
      blockNumber: 'ASC',
    },
  })

  const cancellationsMap = {}
  for (let i = 0; i < cancellations.length; i++) {
    const o = cancellations[i]
    const key = `${o.chainId}_${helper.checkSum(o.ownerAddress)}_${helper.checkSum(o.destinationAddress)}`

    const clearAllKey = `${o.chainId}_${helper.checkSum(o.ownerAddress)}_${o.profileUrl}`
    const latestClearBlock = clearAllLatestMap[clearAllKey]

    if (latestClearBlock && latestClearBlock > o.blockNumber) {
      // don't add if the latest cancel block is greater than the current individual cancellation
    } else {
      if (cancellationsMap[key]) {
        cancellationsMap[key] = Number(cancellationsMap[key]) + 1
      } else {
        cancellationsMap[key] = 1
      }
    }
  }

  return matches
    .filter(o => {
      const key = `${o.chainId}_${helper.checkSum(o.ownerAddress)}_${o.profileUrl}`
      const latestBlock = clearAllLatestMap[key]

      if (!latestBlock) {
        return true
      } else {
        return o.blockNumber >= latestBlock
      }
    })
    .filter(o => {
      const key = `${o.chainId}_${helper.checkSum(o.ownerAddress)}_${helper.checkSum(o.destinationAddress)}`
      if (Number(cancellationsMap[key]) > 0) {
        cancellationsMap[key] = Number(cancellationsMap[key]) - 1
        return false
      } else {
        return true
      }
    })
    .map(e => {
      return {
        id: e.id,
        url: e.profileUrl,
        owner: e.ownerAddress,
      }
    })
}

const getApprovedAssociations = async (
  _: any,
  args: gql.QueryGetApprovedAssociationsArgs,
  ctx: Context,
): Promise<Array<gql.ApprovedAssociationOutput>> => {
  const { user, repositories, wallet, chain } = ctx
  const chainId = chain.id || process.env.CHAIN_ID
  auth.verifyAndGetNetworkChain('ethereum', chainId)
  logger.debug('getApprovedAssociations', { loggedInUserId: user.id, wallet: wallet.address })

  const approvals = await repositories.event.find({
    where: {
      eventName: 'AssociateSelfWithUser',
      ownerAddress: helper.checkSum(wallet.address),
      chainId: wallet.chainId,
      profileUrl: args?.profileUrl,
      ignore: false,
      hidden: false,
    },
    order: {
      blockNumber: 'ASC',
    },
  })

  return approvals.map(e => {
    return {
      id: e.id,
      receiver: e.destinationAddress,
      hidden: e.hidden,
    }
  })
}

const getRejectedAssociations = async (
  _: any,
  args: gql.QueryGetRejectedAssociationsArgs,
  ctx: Context,
): Promise<Array<gql.RejectedAssociationOutput>> => {
  const { user, repositories, wallet, chain } = ctx
  const chainId = chain.id || process.env.CHAIN_ID
  auth.verifyAndGetNetworkChain('ethereum', chainId)
  logger.debug('getApprovedAssociations', { loggedInUserId: user.id, wallet: wallet.address })

  const rejections = await repositories.event.find({
    where: {
      ownerAddress: helper.checkSum(wallet.address),
      chainId: wallet.chainId,
      profileUrl: args?.profileUrl,
      ignore: true,
      hidden: false,
    },
    order: {
      blockNumber: 'ASC',
    },
  })

  return rejections.map(e => {
    return {
      id: e.id,
      receiver: e.destinationAddress,
      hidden: e.hidden,
    }
  })
}

const getRemovedAssociationsForReceiver = async (
  _: any,
  args: any,
  ctx: Context,
): Promise<Array<gql.RemovedAssociationsForReceiverOutput>> => {
  const { user, repositories, wallet, chain } = ctx
  const chainId = chain.id || process.env.CHAIN_ID
  auth.verifyAndGetNetworkChain('ethereum', chainId)
  logger.debug('getRemovedAssociationsAsReceiver', { loggedInUserId: user.id, wallet: wallet.address })

  const removals = await repositories.event.find({
    where: {
      eventName: 'CancelledEvmAssociation',
      destinationAddress: helper.checkSum(wallet.address),
      chainId: wallet.chainId,
      ignore: false,
      hidden: false,
    },
    order: {
      blockNumber: 'ASC',
    },
  })

  return removals.map(e => {
    return {
      id: e.id,
      url: e.profileUrl,
      owner: e.ownerAddress,
      hidden: e.hidden,
    }
  })
}

const getRemovedAssociationsForSender = async (
  _: any,
  args: gql.QueryGetRemovedAssociationsForSenderArgs,
  ctx: Context,
): Promise<Array<gql.RemovedAssociationsForSenderOutput>> => {
  const { user, repositories, wallet, chain } = ctx
  const chainId = chain.id || process.env.CHAIN_ID
  auth.verifyAndGetNetworkChain('ethereum', chainId)
  logger.debug('getRemovedAssociationsAsSender', { loggedInUserId: user.id, wallet: wallet.address })

  const removals = await repositories.event.find({
    where: {
      eventName: 'RemovedAssociateProfile',
      profileUrl: args?.profileUrl,
      ownerAddress: helper.checkSum(wallet.address),
      chainId: wallet.chainId,
      ignore: false,
      hidden: false,
    },
    order: {
      blockNumber: 'ASC',
    },
  })

  return removals.map(e => {
    return {
      id: e.id,
      receiver: e.destinationAddress,
      hidden: e.hidden,
    }
  })
}

const getMyGenesisKeys = async (_: any, args: unknown, ctx: Context): Promise<Array<gql.GkOutput>> => {
  const { user, repositories } = ctx
  logger.debug('getMyGenesisKeys', { loggedInUserId: user.id })

  return repositories.wallet
    .findByUserId(user.id)
    .then(fp.rejectIfEmpty(appError.buildNotFound(mintError.buildWalletEmpty(), mintError.ErrorType.WalletEmpty)))
    .then(async wallet => {
      const address = wallet[0]?.address
      const cacheKey = `${CacheKeys.CACHED_GKS}_${wallet[0].chainId}_${contracts.genesisKeyAddress(wallet[0].chainId)}`
      const cachedGks = await cache.get(cacheKey)
      let gk_owners

      const genesisKeyContract = typechain.GenesisKey__factory.connect(
        contracts.genesisKeyAddress(wallet[0].chainId),
        provider.provider(Number(wallet[0].chainId)),
      )

      if (!cachedGks) {
        gk_owners = {}

        const totalSupply = Number(await genesisKeyContract.totalSupply())
        for (let i = 1; i <= totalSupply; i += 500) {
          const startIndex = i
          const endIndex = i + 499 < totalSupply ? i + 499 : totalSupply

          const owners = await genesisKeyContract.multiOwnerOf(startIndex, endIndex) // inclusive
          owners.map((owner, index) => {
            if (gk_owners[owner]) {
              gk_owners[owner].push(i + index)
            } else {
              gk_owners[owner] = [i + index]
            }
          })
        }

        await cache.set(cacheKey, JSON.stringify(gk_owners), 'EX', 60 * 2) // 2 minutest
      } else {
        gk_owners = JSON.parse(cachedGks)
      }

      // parse and filter
      const keyIds = gk_owners[utils.getAddress(address)]

      if (!keyIds) {
        return []
      }

      const uri = await genesisKeyContract.tokenURI(keyIds[0])
      const strippedUri = uri.replace('ipfs://', '')
      const ipfsHash = strippedUri.split('/')[0]

      return keyIds.map(async keyId => {
        const fullUrl = `https://nft-llc.mypinata.cloud/ipfs/${ipfsHash}/${keyId}`

        const cachedGkData = await cache.get(fullUrl)
        const metadata = cachedGkData ?? (await axios.get(fullUrl)).data

        return {
          tokenId: keyId,
          metadata,
        }
      })
    })
}

const getMyApprovals = (parent: gql.User, _: unknown, ctx: Context): Promise<gql.Approval[]> => {
  const { user, repositories } = ctx
  logger.debug('getMyApprovals', { userId: parent.id, loggedInUserId: user.id })
  if (user.id !== parent.id) {
    return null
  }
  return repositories.approval.findByUserId(user.id)
}

export const updateHideIgnored = async (
  _: any,
  args: gql.MutationUpdateHideIgnoredArgs,
  ctx: Context,
): Promise<gql.UpdateHideIgnoredOutput> => {
  try {
    const { wallet, repositories, chain } = ctx
    const chainId = chain.id || process.env.CHAIN_ID
    auth.verifyAndGetNetworkChain('ethereum', chainId)
    logger.debug('updateHideIgnored', { input: args?.input })

    for (let i = 0; i < args?.input?.eventIdArray.length; i++) {
      const id = args?.input?.eventIdArray[i]

      const event = await repositories.event.findOne({
        where: {
          id,
          ownerAddress: helper.checkSum(wallet.address),
          ignore: true,
        },
      })

      if (event) {
        if (args?.input.hideIgnored) {
          await repositories.event.updateOneById(event.id, { hideIgnored: true })
        } else {
          await repositories.event.updateOneById(event.id, { hideIgnored: false, ignore: false })
        }
      } else {
        return Promise.reject(
          appError.buildExists(
            userError.buildEventNotFoundMsg(
              `event id ${id} not found with ownerAddress ${helper.checkSum(wallet.address)} and ignore = true`,
            ),
            userError.ErrorType.EventAction,
          ),
        )
      }
    }

    return {
      message: args?.input.hideIgnored
        ? 'Updated hidden events to be invisible'
        : 'Updated hidden events to be visible',
    }
  } catch (err) {
    Sentry.captureMessage(`Error in updateHideIgnored: ${err}`)
    return err
  }
}

export const updateHidden = async (
  _: any,
  args: gql.MutationUpdateHiddenArgs,
  ctx: Context,
): Promise<gql.UpdateHiddenOutput> => {
  try {
    const { repositories, chain } = ctx
    const chainId = chain.id || process.env.CHAIN_ID
    auth.verifyAndGetNetworkChain('ethereum', chainId)
    logger.debug('updateHidden', { input: args?.input })

    for (let i = 0; i < args?.input?.eventIdArray.length; i++) {
      const id = args?.input?.eventIdArray[i]
      const event = await repositories.event.findById(id)
      if (event) {
        await repositories.event.updateOneById(event.id, { hidden: args?.input.hidden })
      } else {
        return Promise.reject(
          appError.buildExists(
            userError.buildEventNotFoundMsg(`event id ${id} not found`),
            userError.ErrorType.EventAction,
          ),
        )
      }
    }

    return {
      message: args?.input.hidden ? 'Events are updated to be invisible' : 'Events are updated be visible',
    }
  } catch (err) {
    Sentry.captureMessage(`Error in updateHidden: ${err}`)
    return err
  }
}

export const updateCache = async (
  _: any,
  args: gql.MutationUpdateCacheArgs,
  ctx: Context,
): Promise<gql.UpdateCacheOutput> => {
  try {
    const { chain } = ctx
    const chainId = chain.id || process.env.CHAIN_ID
    auth.verifyAndGetNetworkChain('ethereum', chainId)
    logger.debug('updateCache', { input: args?.input })
    if (args?.input.expireSeconds) {
      await cache.set(args?.input.key, args?.input.value, 'EX', Number(args?.input.expireSeconds))
    } else {
      await cache.set(args?.input.key, args?.input.value)
    }

    return {
      message: 'Cache value is updated.',
    }
  } catch (err) {
    Sentry.captureMessage(`Error in updateCache: ${err}`)
    return err
  }
}

export const clearQueue = async (
  _: any,
  args: gql.MutationClearQueueArgs,
  ctx: Context,
): Promise<gql.ClearQueueOutput> => {
  try {
    const { chain } = ctx
    const chainId = chain.id || process.env.CHAIN_ID
    auth.verifyAndGetNetworkChain('ethereum', chainId)
    logger.debug('clearQueue', { queue: args?.queue })

    const msg = await obliterateQueue(args?.queue)

    return {
      message: msg,
    }
  } catch (err) {
    Sentry.captureMessage(`Error in updateCache: ${err}`)
    return err
  }
}

export const sendReferEmail = async (
  _: any,
  args: gql.MutationSendReferEmailArgs,
  ctx: Context,
): Promise<gql.SendReferEmailOutput> => {
  try {
    const { repositories, user, chain } = ctx
    const chainId = chain.id || process.env.CHAIN_ID
    auth.verifyAndGetNetworkChain('ethereum', chainId)
    logger.debug('sendReferEmail', { input: args?.input })
    const profileUrl = args?.input.profileUrl
    const emails = args?.input.emails
    const profile = await repositories.profile.findByURL(profileUrl, chainId)
    if (!profile) {
      return Promise.reject(new Error(`Profile Url is invalid ${profileUrl}`))
    }
    const profileOwner = await repositories.user.findById(profile.ownerUserId)
    if (profileOwner.id !== user.id) {
      return Promise.reject(new Error(`You are not owner of this profile ${profileUrl}`))
    }
    let sent = 0
    const confirmedEmails = []
    const unconfirmedEmails = []
    const sentEmails = []
    await Promise.allSettled(
      emails.map(async email => {
        const referralId = cryptoRandomString({ length: 10, type: 'url-safe' })
        const referredBy = profileOwner.referralId + '::' + profileUrl
        const confirmEmailToken = cryptoRandomString({ length: 36, type: 'url-safe' })
        const confirmEmailTokenExpiresAt = addDays(helper.toUTCDate(), 1)
        const existingUser = await repositories.user.findByEmail(email)
        // if user is not created by email
        if (!existingUser) {
          // create unverified user with this email
          await repositories.user.save({
            email,
            username: `unverified_${email}_${referralId}`,
            referralId,
            referredBy,
            confirmEmailToken,
            confirmEmailTokenExpiresAt,
          })
          const res = await sendgrid.sendReferralEmail(email, profileOwner.referralId, profileUrl, referralId)
          if (res) {
            sentEmails.push(email)
            sent++
          } else {
            logger.error('Something went wrong with sending referral email')
          }
        } else {
          // if user with email exists, we check confirmEmailTokenExpiresAt to if user is verified or not
          if (existingUser.isEmailConfirmed) {
            confirmedEmails.push(email)
          } else {
            const now = helper.toUTCDate()
            if (existingUser.confirmEmailTokenExpiresAt && existingUser.confirmEmailTokenExpiresAt > now) {
              unconfirmedEmails.push(email)
            } else {
              // extend confirmEmailTokenExpiresAt of user one day
              await repositories.user.updateOneById(existingUser.id, {
                confirmEmailToken,
                confirmEmailTokenExpiresAt,
              })
              const res = await sendgrid.sendReferralEmail(email, profileOwner.referralId, profileUrl, referralId)
              if (res) {
                sentEmails.push(email)
                sent++
              } else {
                logger.error('Something went wrong with sending referral email')
              }
            }
          }
        }
      }),
    )

    return {
      message: `Referral emails are sent to ${sent} addresses.`,
      confirmedEmails,
      unconfirmedEmails,
      sentEmails,
    }
  } catch (err) {
    Sentry.captureMessage(`Error in sendReferEmail: ${err}`)
    return err
  }
}

const getProfileActions = async (_: any, args: any, ctx: Context): Promise<Array<gql.ProfileActionOutput>> => {
  const { user, repositories, wallet, chain } = ctx
  const chainId = chain.id || process.env.CHAIN_ID
  auth.verifyAndGetNetworkChain('ethereum', chainId)
  logger.debug('getProfileActions', { loggedInUserId: user.id, wallet: wallet.address })
  const actions = await repositories.incentiveAction.find({
    where: {
      userId: user.id,
    },
  })
  return actions.map(action => {
    return {
      profileUrl: action.profileUrl,
      action: profileActionType(action),
      point: action.point,
    }
  })
}

const getProfilesActionsWithPoints = async (
  parent: gql.User,
  _: unknown,
  ctx: Context,
): Promise<Array<gql.UsersActionOutput>> => {
  const { user, repositories, chain } = ctx
  const chainId = chain.id || process.env.CHAIN_ID
  auth.verifyAndGetNetworkChain('ethereum', chainId)
  const actions = await repositories.incentiveAction.find({
    where: {
      userId: user.id,
    },
  })
  const seen = {}
  const profilesActions: gql.ProfilesActionsOutput[] = []
  for (const action of actions) {
    if (!seen[action.profileUrl]) {
      profilesActions.push({
        url: action.profileUrl,
        action: [profileActionType(action)],
        totalPoints: action.point,
      })
      seen[action.profileUrl] = true
    } else {
      const index = profilesActions.findIndex(profileAction => profileAction.url === action.profileUrl)
      if (index !== -1) {
        profilesActions[index].action.push(profileActionType(action))
        profilesActions[index].totalPoints += action.point
      }
    }
  }
  return profilesActions
}

const getSentReferralEmails = async (
  _: any,
  args: gql.QueryGetSentReferralEmailsArgs,
  ctx: Context,
): Promise<Array<gql.SentReferralEmailsOutput>> => {
  try {
    const { user, repositories, wallet, chain } = ctx
    const chainId = chain.id || process.env.CHAIN_ID
    auth.verifyAndGetNetworkChain('ethereum', chainId)
    logger.debug('getSentReferralEmails', { loggedInUserId: user.id, wallet: wallet.address })

    const referralKey = `${user.referralId}::${args?.profileUrl}`
    const referredUsers = await repositories.user.find({
      where: {
        referredBy: referralKey,
      },
    })

    logger.info(`getSentReferralEmails ${referralKey}, length=${referredUsers.length}`)
    const res = []
    await Promise.allSettled(
      referredUsers.map(async referUser => {
        let accepted = false
        if (referUser.isEmailConfirmed) {
          const profile = await repositories.profile.findOne({
            where: {
              ownerUserId: referUser.id,
            },
          })
          if (profile) accepted = true
        }
        res.push({
          email: referUser.email,
          accepted,
          timestamp: referUser.createdAt,
        })
        logger.info(
          `getSentReferralEmails ${referralKey}, email=${referUser.email}, accepted=${accepted}, timestamp=${referUser.createdAt}`,
        )
      }),
    )

    logger.info(`getSentReferralEmails ${referralKey}, res=${JSON.stringify(res)}`)
    return res
  } catch (err) {
    Sentry.captureMessage(`Error in getSentReferralEmails: ${err}`)
    return err
  }
}

export default {
  Query: {
    me: combineResolvers(auth.isAuthenticated, core.resolveEntityFromContext('user')),
    getMyGenesisKeys: combineResolvers(auth.isAuthenticated, getMyGenesisKeys),
    getMyPendingAssociations: combineResolvers(auth.isAuthenticated, getMyPendingAssociations),
    getApprovedAssociations: combineResolvers(auth.isAuthenticated, getApprovedAssociations),
    getRejectedAssociations: combineResolvers(auth.isAuthenticated, getRejectedAssociations),
    getRemovedAssociationsForReceiver: combineResolvers(auth.isAuthenticated, getRemovedAssociationsForReceiver),
    getRemovedAssociationsForSender: combineResolvers(auth.isAuthenticated, getRemovedAssociationsForSender),
    getProfileActions: combineResolvers(auth.isAuthenticated, getProfileActions),
    getSentReferralEmails: combineResolvers(auth.isAuthenticated, getSentReferralEmails),
  },
  Mutation: {
    signUp,
    confirmEmail,
    updateEmail,
    updateMe: combineResolvers(auth.isAuthenticated, updateMe),
    ignoreAssociations: combineResolvers(auth.isAuthenticated, ignoreAssociations),
    updateHideIgnored: combineResolvers(auth.isAuthenticated, updateHideIgnored),
    updateHidden: combineResolvers(auth.isAuthenticated, updateHidden),
    resendEmailConfirm: combineResolvers(auth.isAuthenticated, resendEmailConfirm),
    updateCache: combineResolvers(auth.isAuthenticated, updateCache),
    clearQueue: combineResolvers(auth.isAuthenticated, clearQueue),
    sendReferEmail: combineResolvers(auth.isAuthenticated, sendReferEmail),
  },
  User: {
    myAddresses: combineResolvers(auth.isAuthenticated, getMyAddresses),
    myApprovals: combineResolvers(auth.isAuthenticated, getMyApprovals),
    profilesActionsWithPoints: combineResolvers(auth.isAuthenticated, getProfilesActionsWithPoints),
  },
}
