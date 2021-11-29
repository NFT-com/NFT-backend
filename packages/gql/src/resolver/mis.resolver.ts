import STS from 'aws-sdk/clients/sts'
import { combineResolvers } from 'graphql-resolvers'

import { assetBucket } from '@nftcom/gql/config'
import { Context, gql } from '@nftcom/gql/defs'
import { auth } from '@nftcom/gql/helper'
import { _logger, helper } from '@nftcom/shared/helper'

const logger = _logger.Factory(_logger.Context.Misc, _logger.Context.GraphQL)
const sts = new STS()

const getFileUploadSession = (
  _: unknown,
  args: unknown,
  ctx: Context,
): Promise<gql.FileUploadOutput> => {
  const { user } = ctx
  logger.debug('getFileUploadSession', { loggedInUserId: user.id })

  const params: STS.AssumeRoleRequest = {
    RoleArn: assetBucket.role,
    RoleSessionName: `upload-file-to-asset-bucket-${helper.toIsoDateString}`,
  }

  return sts.assumeRole(params).promise()
    .then((response) => ({
      accessKey: response.Credentials.AccessKeyId,
      bucket: assetBucket.name,
      secretKey: response.Credentials.SecretAccessKey,
      sessionToken: response.Credentials.SessionToken,
    }))
}

export default {
  Mutation: {
    uploadFileSession: combineResolvers(auth.isAuthenticated, getFileUploadSession),
  },
}
