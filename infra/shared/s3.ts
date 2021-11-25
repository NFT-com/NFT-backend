import * as aws from '@pulumi/aws'

import { getStage, joinStringsByDash } from '../helper'

export type S3Output = {
  asset: aws.s3.Bucket
  deployApp: aws.s3.Bucket
}

export const createAsset = (): aws.s3.Bucket => {
  const bucketName = joinStringsByDash('nftcom', getStage(), 'assets')
  return new aws.s3.Bucket('s3_asset', {
    bucket: bucketName,
    acl: 'private',
    policy: {
      Version: '2012-10-17',
      Statement: [
        {
          Principal: '*',
          Effect: 'Allow',
          Action: 's3:GetObject',
          Resource: `arn:aws:s3:::${bucketName}/*`,
        },
      ],
    },
  })
}

export const createAppDeploy = (): aws.s3.Bucket => {
  const bucketName = joinStringsByDash('nftcom', getStage(), 'deploy-app')
  return new aws.s3.Bucket('s3_deploy_app', {
    bucket: bucketName,
    acl: 'private',
  })
}

export const createBuckets = (): S3Output => {
  const asset = createAsset()
  const deployApp = createAppDeploy()
  return { asset, deployApp }
}
