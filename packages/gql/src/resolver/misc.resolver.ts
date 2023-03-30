import { combineResolvers } from 'graphql-resolvers'

import { AssumeRoleRequest, STS } from '@aws-sdk/client-sts'
import { assetBucket } from '@nftcom/gql/config'
import { Context, gql } from '@nftcom/gql/defs'
import { auth } from '@nftcom/gql/helper'
import { getSymbolInUsd } from '@nftcom/gql/service/core.service'
import { _logger, helper } from '@nftcom/shared'

const logger = _logger.Factory(_logger.Context.Misc, _logger.Context.GraphQL)

let cachedSTS: STS = null
const getSTS = (): STS => {
  if (helper.isEmpty(cachedSTS)) {
    cachedSTS = new STS({ region: process.env.AWS_REGION })
  }
  return cachedSTS
}

const getFileUploadSession = async (_: unknown, args: unknown, ctx: Context): Promise<gql.FileUploadOutput> => {
  const { user } = ctx
  logger.debug('getFileUploadSession', { loggedInUserId: user.id })

  const sessionName = `upload-file-to-asset-bucket-${helper.toTimestamp()}`
  const params: AssumeRoleRequest = {
    RoleArn: assetBucket.role,
    RoleSessionName: sessionName,
  }

  const response = await getSTS().assumeRole(params)
  return {
    accessKey: response.Credentials.AccessKeyId,
    bucket: assetBucket.name,
    secretKey: response.Credentials.SecretAccessKey,
    sessionToken: response.Credentials.SessionToken,
  }
}

const fetchEthUsd = async (_: unknown, __: unknown, ___: Context): Promise<number> => {
  return await getSymbolInUsd('ETH')
}

export default {
  Query: {
    fetchEthUsd,
  },
  Mutation: {
    uploadFileSession: combineResolvers(auth.isAuthenticated, getFileUploadSession),
  },
}
