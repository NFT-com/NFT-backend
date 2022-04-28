import STS from 'aws-sdk/clients/sts'
import { BigNumber } from 'ethers'
import { combineResolvers } from 'graphql-resolvers'

import { assetBucket } from '@nftcom/gql/config'
import { Context, gql } from '@nftcom/gql/defs'
import { auth } from '@nftcom/gql/helper'
import { _logger, defs, entity, helper } from '@nftcom/shared'

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

const median = (arr: Array<number>): string => {
  const middle: number = Math.floor(arr.length / 2)
  arr = [...arr].sort((a, b) => BigNumber.from(a).gt(BigNumber.from(b)) ? 0 : -1)
  return arr.length % 2 !== 0 ?
    BigNumber.from(arr[middle]).toString() :
    BigNumber.from(arr[middle - 1]).add(BigNumber.from(arr[middle])).div(2).toString()
}

const endGKBlindAuction = (
  _: unknown,
  args: unknown,
  ctx: Context,
): Promise<gql.EndGkOutput> => {
  const { repositories } = ctx

  return repositories.bid.find({
    where: { nftType: defs.NFTType.GenesisKey }, order:  { price: 'DESC' },
  })
    .then((bids: entity.Bid[]) => {
      const sortedBids = bids.sort((a, b) =>
        BigNumber.from(a.price).gt(BigNumber.from(b.price)) ? -1 : 1)

      return Promise.all(sortedBids.map(bid => {
        return repositories.wallet.findById(bid.walletId)
      }))
        .then((wallets: entity.Wallet[]) =>
          [bids, wallets])
    })
    .then(([bids, wallets]: [entity.Bid[], entity.Wallet[]]) => {
      const topBidPerWallet = {}
      const firstLosingBid = []

      for (let i = 0; i < wallets.length; i++) {
        const price = BigNumber.from(bids[i]?.price ?? 0)
        const wallet = wallets[i]?.address

        if (Object.keys(topBidPerWallet).length < 3000) {
          const currentTopBid = topBidPerWallet[wallet] ?? 0

          topBidPerWallet[wallet] = price.gt(BigNumber.from(currentTopBid)) ?
            price.toString() : BigNumber.from(currentTopBid).toString()

          logger.debug(`new top bid ${topBidPerWallet[wallet]} for ${wallet}`)
        } else {
          logger.debug(`1st loser bid is ${price} for ${wallet}`)
          firstLosingBid.push({ key: wallet, value: price.toString() })
          break
        }
      }

      const sortedTopBids = Object.keys(topBidPerWallet)
        .sort((a, b) => {
          if (topBidPerWallet[a] && topBidPerWallet[b]) {
            return BigNumber.from(topBidPerWallet[a])
              .gt(BigNumber.from(topBidPerWallet[b])) ? -1 : 1
          }

          return 1
        })
        .map(key => {
          return { key, value: topBidPerWallet[key] }
        })

      return {
        topBids: sortedTopBids,
        firstLosingBid: firstLosingBid.length > 0 ? firstLosingBid : [
          sortedTopBids[sortedTopBids.length - 1],
        ] ?? [],
        whitelistWinnersCount: Object.keys(topBidPerWallet).length,
        medianPrice: Object.values(topBidPerWallet).length > 0 ?
          median(Object.values(topBidPerWallet)).toString() : '',
        totalBidsCount: bids.length,
      }
    })
}

// const getContracts = (
//   _: any,
//   args: gql.QueryGetContractsArgs,
// ): gql.GetContracts => {
//   const { input } = args
//   const { chainId } = input

//   return {
//     marketplace: contracts.nftMarketplaceAddress(chainId),
//     marketplaceEvent: contracts.marketplaceEventAddress(chainId),
//     validationLogic: contracts.validationLogicAddress(chainId),
//     nftToken: contracts.nftTokenAddress(chainId),
//     profileAuction: contracts.profileAuctionAddress(chainId),
//     nftProfile: contracts.nftProfileAddress(chainId),
//     genesisKey: contracts.genesisKeyAddress(chainId),
//     genesisKeyStake: contracts.genesisKeyStakeAddress(chainId),
//     genesisKeyTeamClaim: contracts.genesisKeyTeamClaimAddress(chainId),
//     genesisKeyDistributor: contracts.genesisKeyDistributor(chainId),
//     genesisKeyTeamMerkle: contracts.genesisKeyTeamMerkleAddress(chainId),
//   }
// }

export default {
  Query: {
    // getContracts,
  },
  Mutation: {
    uploadFileSession: combineResolvers(auth.isAuthenticated, getFileUploadSession),
    endGKBlindAuction: combineResolvers(auth.isTeamAuthenticated, endGKBlindAuction),
  },
}