import STS from 'aws-sdk/clients/sts'
import { Contract, Wallet } from 'ethers'
import { BigNumber } from 'ethers'
import { combineResolvers } from 'graphql-resolvers'

import { assetBucket } from '@nftcom/gql/config'
import { Context, gql, Pageable } from '@nftcom/gql/defs'
import { appError, approvalError, mintError, profileError, userError, walletError } from '@nftcom/gql/error'
import { auth, pagination } from '@nftcom/gql/helper'
import { core } from '@nftcom/gql/service'
import { _logger, entity,fp,helper, provider } from '@nftcom/shared'
import { ProfileStatus } from '@nftcom/shared/defs'
import { profileAuctionABI, profileAuctionAddress } from '@nftcom/shared/helper/contracts'

import { BidStatus } from '../defs/gql'

const logger = _logger.Factory(_logger.Context.Misc, _logger.Context.GraphQL)

let cachedSTS: STS = null
const getSTS = (): STS => {
  if (helper.isEmpty(cachedSTS)) {
    cachedSTS = new STS()
  }
  return cachedSTS
}

const getFileUploadSession = (
  _: unknown,
  args: unknown,
  ctx: Context,
): Promise<gql.FileUploadOutput> => {
  const { user } = ctx
  logger.debug('getFileUploadSession', { loggedInUserId: user.id })

  const sessionName = `upload-file-to-asset-bucket-${helper.toTimestamp()}`
  const params: STS.AssumeRoleRequest = {
    RoleArn: assetBucket.role,
    RoleSessionName: sessionName,
  }

  return getSTS().assumeRole(params).promise()
    .then((response) => ({
      accessKey: response.Credentials.AccessKeyId,
      bucket: assetBucket.name,
      secretKey: response.Credentials.SecretAccessKey,
      sessionToken: response.Credentials.SessionToken,
    }))
}

const endProfileAuction = (
  _: unknown,
  args: gql.MutationEndProfileAuctionArgs,
  ctx: Context,
): Promise<gql.EndAuctionOutput> => {
  const { repositories } = ctx
  const { input } = args
  
  logger.debug('endProfileAuction', { profileId: input?.profileId, walletId: input?.walletId })

  return repositories.wallet.findById(input?.walletId)
    .then(fp.rejectIfEmpty(appError.buildNotFound(
      walletError.buildAddressNotFoundMsg(),
      walletError.ErrorType.AddressNotFound,
    )))
    .then((wallet: entity.Wallet) => wallet.userId)
    .then((userId: string) => repositories.user.findById(userId))
    .then(fp.rejectIfEmpty(appError.buildNotFound(
      userError.buildUserNotFoundMsg(''),
      userError.ErrorType.UserNotFound,
    )))
    .then((user: entity.User) => Promise.all([
      Promise.resolve(user),
      repositories.wallet.findByUserId(user.id),
    ]))
    .then(([user, wallets]: [entity.User, entity.Wallet[]]) => {
      const inputWallet = wallets.filter(w => w.id === input.walletId)[0]
      return Promise.all([
        Promise.resolve(inputWallet),
        repositories.approval.findMaxNFTApprovalByUserId(user.id, inputWallet.chainId)
          .then(fp.rejectIfEmpty(appError.buildNotFound(
            approvalError.buildApprovalNotFoundMsg(),
            approvalError.ErrorType.ApprovalNotFound,
          ))),
        repositories.profile.findById(input?.profileId)
          .then(fp.rejectIfEmpty(appError.buildNotFound(
            profileError.buildProfileNotFoundMsg(input?.profileId),
            profileError.ErrorType.ProfileNotFound,
          ))),
      ])
    })
    .then((
      [wallet, approval, profile]:
      [entity.Wallet, entity.Approval, entity.Profile],
    ) => {
      return Promise.all([
        Promise.resolve(wallet),
        Promise.resolve(approval),
        Promise.resolve(profile),
        core.paginatedEntitiesBy(
          ctx.repositories.bid,
          { first: 1 },
          { profileId: profile.id },
          'price',
        )
          .then(pagination.toPageable({ first: 1 }, 'price'))
          .then(fp.rejectIfEmpty(
            appError.buildNotFound(
              'Profile has no bids.',
              profileError.ErrorType.ProfileNotFound,
            )))
          .then((bids: Pageable<entity.Bid>) => bids.items[0]),
      ])
    })
    .then(async ([wallet, approval, profile, topBid]) => {
      if (BigNumber.from(approval.amount).lt(BigNumber.from(topBid.price))) {
        return Promise.reject(appError.buildInvalid(
          approvalError.buildApprovalInsufficientMsg(),
          approvalError.ErrorType.ApprovalInsufficient,
        ))
      }
      if (topBid.walletId !== wallet.id) {
        return Promise.reject(appError.buildInvalid(
          mintError.buildWalletLosingMsg(),
          mintError.ErrorType.WalletLosing,
        ))
      }
      const overrides = {
        // The maximum units of gas for the transaction to use
        gasLimit: 1500000,
        gasPrice: Number(10) * 1000000000, // wei
      }
      const signer = Wallet.fromMnemonic(process.env.MNEMONIC)
        .connect(provider.provider(Number(wallet.chainId)))
      const profileAuctionContract = new Contract(
        profileAuctionAddress(wallet.chainId),
        profileAuctionABI(),
        signer,
      )
      const tx = await profileAuctionContract.mintProfileFor(
        topBid.price,
        profile.url,
        wallet.address,
        topBid.signature.v,
        topBid.signature.r,
        topBid.signature.s,
        approval.signature.v,
        approval.signature.r,
        approval.signature.s,
        overrides,
      )

      topBid.status = BidStatus.Executed
      profile.ownerUserId = topBid.userId
      profile.ownerWalletId = topBid.walletId
      profile.status = ProfileStatus.Pending
      const hash = tx.hash
      return Promise.all([
        Promise.resolve(hash),
        repositories.bid.save(topBid),
        repositories.profile.save(profile),
        provider.provider(Number(wallet.chainId)).waitForTransaction(hash),
      ])
    })
    .then(([txHash]) => {
      return { txHash }
    })
}

export default {
  Mutation: {
    uploadFileSession: combineResolvers(auth.isAuthenticated, getFileUploadSession),
    endProfileAuction: combineResolvers(auth.isTeamAuthenticated, endProfileAuction),
  },
}
