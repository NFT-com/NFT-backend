import axios from 'axios'
import cryptoRandomString from 'crypto-random-string'
import { addDays } from 'date-fns'
import { utils } from 'ethers'
import { combineResolvers } from 'graphql-resolvers'
import Joi from 'joi'

import { Context, gql } from '@nftcom/gql/defs'
import { appError, mintError, userError, walletError } from '@nftcom/gql/error'
import { auth, joi } from '@nftcom/gql/helper'
import { core, sendgrid } from '@nftcom/gql/service'
import { cache } from '@nftcom/gql/service/cache.service'
import { _logger, contracts, defs, entity, fp, helper, provider, typechain } from '@nftcom/shared'

const logger = _logger.Factory(_logger.Context.User, _logger.Context.GraphQL)

const signUp = (
  _: any,
  args: gql.MutationSignUpArgs,
  ctx: Context,
): Promise<gql.User> => {
  const { repositories } = ctx
  logger.debug('signUp', { input: args.input })

  const schema = Joi.object().keys({
    avatarURL: Joi.string(),
    email: Joi.string().email(),
    username: Joi.string(),
    referredBy: Joi.string(),
    wallet: joi.buildWalletInputSchema(),
  })
  joi.validateSchema(schema, args.input)

  const { email, username, avatarURL, referredBy = '', wallet } = args.input
  const { address, network, chainId } = wallet
  const chain = auth.verifyAndGetNetworkChain(network, chainId)

  return Promise.all([
    repositories.user.exists({ username, email }),
    repositories.wallet.exists({ network, chainId, address }),
  ])
    .then(([userExists, addressExists]) => {
      if (userExists) {
        return Promise.reject(appError.buildExists(
          userError.buildUsernameExistsMsg(username),
          userError.ErrorType.UsernameAlreadyExists,
        ))
      }
      if (addressExists) {
        return Promise.reject(appError.buildExists(
          walletError.buildAddressExistsMsg(network, chain, address),
          walletError.ErrorType.AddressAlreadyExists,
        ))
      }
      return referredBy
    })
    .then(fp.thruIfNotEmpty((refId: string) => {
      return repositories.user.findByReferralId(refId)
        .then((user) => user?.id)
    }))
    .then((referredUserId: string) => {
      const confirmEmailToken = cryptoRandomString({ length: 6, type: 'numeric' })
      const confirmEmailTokenExpiresAt = addDays(helper.toUTCDate(), 1)
      const referralId = cryptoRandomString({ length: 10, type: 'url-safe' })

      return repositories.user.save({
        email,
        username,
        referredBy: referredUserId || null,
        avatarURL,
        confirmEmailToken,
        confirmEmailTokenExpiresAt,
        referralId,
      })
    })
    .then(fp.tapWait<entity.User, unknown>((user) => Promise.all([
      repositories.wallet.save({
        userId: user.id,
        network,
        chainId: chain.id,
        chainName: chain.name,
        address,
      }),
      sendgrid.sendConfirmEmail(user),
    ])))
}

const updateEmail = (
  _: any,
  args: gql.MutationSignUpArgs,
  ctx: Context,
): Promise<entity.User> => {
  const { user, repositories } = ctx
  logger.debug('updateEmail', { input: args.input })

  const schema = Joi.object().keys({
    email: Joi.string().email().required(),
  })
  joi.validateSchema(schema, args.input)

  const { email } = args.input

  const confirmEmailToken = cryptoRandomString({ length: 6, type: 'numeric' })
  const confirmEmailTokenExpiresAt = addDays(helper.toUTCDate(), 1)
  return repositories.user.save({
    ...user,
    email,
    confirmEmailToken,
    confirmEmailTokenExpiresAt,
  })
    .then(fp.tapWait(sendgrid.sendConfirmEmail))
}

const updateReferral = (ctx: Context) => {
  return (otherUser: entity.User): Promise<boolean> => {
    const { user } = ctx
    return core.createEdge(ctx,{
      thisEntityId: otherUser.id,
      thisEntityType: defs.EntityType.User,
      thatEntityId: user.id,
      thatEntityType: defs.EntityType.User,
      edgeType: defs.EdgeType.Referred,
    })
      .then(() => core.countEdges(ctx, {
        thisEntityId: otherUser.id,
        edgeType: defs.EdgeType.Referred,
      }))
      .then((count) => sendgrid.sendReferredBy(otherUser, count))
  }
}

const confirmEmail = (
  _: any,
  args: gql.MutationConfirmEmailArgs,
  ctx: Context,
): Promise<boolean> => {
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
  return repositories.user.findByEmailConfirmationToken(token)
    .then(fp.rejectIfEmpty(invalidTokenError))
    .then((user) => repositories.user.save({
      ...user,
      isEmailConfirmed: true,
      confirmEmailToken: null,
      confirmEmailTokenExpiresAt: null,
    }))
    .then((user) => {
      if (helper.isEmpty(user.referredBy)) {
        return user
      }
      return repositories.user.findById(user.referredBy)
        .then(fp.tap(updateReferral(ctx)))
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

const updateMe = (
  _: any,
  args: gql.MutationUpdateMeArgs,
  ctx: Context,
): Promise<gql.User> => {
  const { user, repositories } = ctx
  logger.debug('updateMe', { loggedInUserId: user.id, input: args.input })

  const schema = Joi.object().keys({
    avatarURL: Joi.string(),
    email: Joi.string().email(),
    preferences: buildPreferencesInputSchema(),
  })

  joi.validateSchema(schema, args.input)

  const {
    avatarURL = user.avatarURL,
    email = user.email,
    preferences = user.preferences,
  } = args.input
  // TODO notify user?
  return repositories.user.updateOneById(user.id, { avatarURL, email, preferences })
}

const resendEmailConfirm = (
  _: any,
  args: any,
  ctx: Context,
): Promise<entity.User> => {
  const { user, repositories } = ctx
  logger.debug('resendEmailConfirm', { loggedInUserId: user.id })
  const confirmEmailToken = cryptoRandomString({ length: 6, type: 'numeric' })
  const confirmEmailTokenExpiresAt = addDays(helper.toUTCDate(), 1)
  return repositories.user.save({
    ...user,
    confirmEmailToken,
    confirmEmailTokenExpiresAt,
  })
    .then(fp.tapWait(sendgrid.sendConfirmEmail))
}

const getMyAddresses = (
  parent: gql.User,
  _: unknown,
  ctx: Context,
): Promise<gql.Wallet[]> => {
  const { user, repositories } = ctx
  logger.debug('getMyAddresses', { userId: parent.id, loggedInUserId: user.id })
  if (user.id !== parent.id) {
    return null
  }
  return repositories.wallet.findByUserId(parent.id)
}

const ignoreAssocations = (
  _: any,
  args: gql.MutationIgnoreAssocationsArgs,
  ctx: Context,
): Array<Promise<entity.Event>> => {
  const { user, repositories, chain, wallet } = ctx
  const chainId = chain.id || process.env.CHAIN_ID
  auth.verifyAndGetNetworkChain('ethereum', chainId)
  logger.debug('ignoreAssocations', { loggedInUserId: user.id, wallet: wallet.address, args: args?.eventIdArray })
  
  return args?.eventIdArray.map(e =>
    repositories.event.findOne({ where:
      {
        id: e,
        destinationAddress: helper.checkSum(wallet.address),
      },
    }).then(e => {
      if (e) {
        return repositories.event.save({ ...e, ignore: true })
      } else {
        return Promise.reject(appError.buildForbidden(
          userError.buildForbiddenActionMsg(' event id doesn\'t exist under your user'),
          userError.ErrorType.ForbiddenAction,
        ))
      }
    }),
  )
}

const getMyPendingAssocations = async (
  _: any,
  args: unknown,
  ctx: Context,
): Promise<Array<gql.PendingAssociationOutput>> => {
  const { user, repositories, wallet } = ctx
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

  logger.debug('matches: ', matches)

  const clearAlls = await repositories.event.find({
    where: {
      eventName: 'ClearAllAssociatedAddresses',
      chainId: wallet.chainId,
    },
    order: {
      blockNumber: 'ASC',
    },
  })

  logger.debug('clearAlls: ', clearAlls)

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

  logger.debug('clearAllLatestMap: ', clearAllLatestMap)

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
      logger.debug('skip cancellation since outdated')
      // don't add if the latest cancel block is greater than the current individual cancellation
    } else {
      if (cancellationsMap[key]) {
        logger.debug(`additional cancellation: ${key} ${Number(cancellationsMap[key]) + 1}`)
        cancellationsMap[key] = Number(cancellationsMap[key]) + 1
      } else {
        logger.debug(`first cancellation: ${key}`)
        cancellationsMap[key] = 1
      }
    }
  }

  logger.debug('cancellationsMap: ', cancellationsMap)

  return matches
    .filter((o) => {
      const key = `${o.chainId}_${helper.checkSum(o.ownerAddress)}_${o.profileUrl}`
      const latestBlock = clearAllLatestMap[key]
      
      if (!latestBlock) {
        return true
      } else {
        return o.blockNumber >= latestBlock
      }
    })
    .filter((o) => {
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

const getMyGenesisKeys = async (
  _: any,
  args: unknown,
  ctx: Context,
): Promise<Array<gql.GkOutput>> => {
  const { user, repositories } = ctx
  logger.debug('getMyGenesisKeys', { loggedInUserId: user.id })

  return repositories.wallet.findByUserId(user.id)
    .then(fp.rejectIfEmpty(
      appError.buildNotFound(
        mintError.buildWalletEmpty(),
        mintError.ErrorType.WalletEmpty,
      ),
    )).then(async (wallet) => {
      const address = wallet[0]?.address
      const cachedGks = await cache.get(`cached_gks_${wallet[0].chainId}_${contracts.genesisKeyAddress(wallet[0].chainId)}`)
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

        await cache.set(`cached_gks_${wallet[0].chainId}_${contracts.genesisKeyAddress(wallet[0].chainId)}`, JSON.stringify(gk_owners), 'EX', 60 * 2) // 2 minutest
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

      return keyIds.map(async (keyId) => {
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

const getMyApprovals = (
  parent: gql.User,
  _: unknown,
  ctx: Context,
): Promise<gql.Approval[]> => {
  const { user, repositories } = ctx
  logger.debug('getMyApprovals', { userId: parent.id, loggedInUserId: user.id })
  if (user.id !== parent.id) {
    return null
  }
  return repositories.approval.findByUserId(user.id)
}

export default {
  Query: {
    me: combineResolvers(auth.isAuthenticated, core.resolveEntityFromContext('user')),
    getMyGenesisKeys: combineResolvers(auth.isAuthenticated, getMyGenesisKeys),
    getMyPendingAssociations: combineResolvers(auth.isAuthenticated, getMyPendingAssocations),
  },
  Mutation: {
    signUp,
    confirmEmail,
    updateEmail,
    updateMe: combineResolvers(auth.isAuthenticated, updateMe),
    ignoreAssocations: combineResolvers(auth.isAuthenticated, ignoreAssocations),
    resendEmailConfirm: combineResolvers(auth.isAuthenticated, resendEmailConfirm),
  },
  User: {
    myAddresses: combineResolvers(auth.isAuthenticated, getMyAddresses),
    myApprovals: combineResolvers(auth.isAuthenticated, getMyApprovals),
  },
}
