import { combineResolvers } from 'graphql-resolvers'

import { AssumeRoleRequest,STS } from '@aws-sdk/client-sts'
import { assetBucket } from '@nftcom/gql/config'
import { Context, gql } from '@nftcom/gql/defs'
import { auth } from '@nftcom/gql/helper'
import { _logger, helper } from '@nftcom/shared'

const logger = _logger.Factory(_logger.Context.Misc, _logger.Context.GraphQL)

let cachedSTS: STS = null
const getSTS = (): STS => {
  if (helper.isEmpty(cachedSTS)) {
    cachedSTS = new STS({ region: process.env.AWS_REGION })
  }
  return cachedSTS
}

const getFileUploadSession = async (
  _: unknown,
  args: unknown,
  ctx: Context,
): Promise<gql.FileUploadOutput> => {
  const { user } = ctx
  logger.debug('getFileUploadSession', { loggedInUserId: user.id })

  const sessionName = `upload-file-to-asset-bucket-${helper.toTimestamp()}`
  const params: AssumeRoleRequest = {
    RoleArn: assetBucket.role,
    RoleSessionName: sessionName,
  }
  
  const response = await getSTS().assumeRole(params)
  return ({
    accessKey: response.Credentials.AccessKeyId,
    bucket: assetBucket.name,
    secretKey: response.Credentials.SecretAccessKey,
    sessionToken: response.Credentials.SessionToken,
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
  Query: {},
  Mutation: {
    uploadFileSession: combineResolvers(auth.isAuthenticated, getFileUploadSession),
    // endGKBlindAuction: combineResolvers(auth.isTeamAuthenticated, endGKBlindAuction),
  },
}