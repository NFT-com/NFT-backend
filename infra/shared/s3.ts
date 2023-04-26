import * as aws from '@pulumi/aws'

import { getResourceName, getStage, getAccount ,joinStringsByDash } from '../helper'

export type S3Output = {
  asset: aws.s3.Bucket
  assetRole: aws.iam.Role
}

const createAssetRole = (bucketName: string, provider : aws.Provider): aws.iam.Role => {
  const inlinePolicy = {
    Version: '2012-10-17',
    Statement: [
      {
        Action: 's3:PutObject',
        Effect: 'Allow',
        Resource: `arn:aws:s3:::${bucketName}/*`,
      },
    ],
  }
  return new aws.iam.Role('role_asset_bucket', {
    name: getResourceName('asset-bucket.us-east-1'),
    description: 'Role to assume to access Asset bucket',
    assumeRolePolicy: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'sts:AssumeRole',
          Effect: 'Allow',
          Principal: {
            AWS: '*',
          },
        },
      ],
    },
    inlinePolicies: [
      {
        name: 'access-asset-bucket',
        policy: JSON.stringify(inlinePolicy),
      },
    ],
  }, { provider: provider }
  )
}

const createAsset = (provider : aws.Provider): { bucket: aws.s3.Bucket; role: aws.iam.Role } => {
  const bucketName = joinStringsByDash('nftcom', getStage(), getAccount() ,'assets')
  const role = createAssetRole(bucketName, provider)
  const bucket = new aws.s3.Bucket('s3_asset', {
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
        {
          Principal: { AWS: role.arn },
          Effect: 'Allow',
          Action: 's3:PutObject',
          Resource: `arn:aws:s3:::${bucketName}/*`,
        },
      ],
    },
    corsRules: [
      {
        allowedMethods: ['HEAD', 'GET', 'PUT'],
        allowedOrigins: ['*'],
        allowedHeaders: [
          'amz-sdk-invocation-id',
          'amz-sdk-request',
          'authorization',
          'Authorization',
          'content-type',
          'Content-Type',
          'Referer',
          'User-Agent',
          'x-amz-content-sha256',
          'x-amz-date',
          'x-amz-security-token',
          'x-amz-user-agent',
        ],
        maxAgeSeconds: 3000,
      },
    ],
  }, { provider: provider }
  )

  return { role, bucket }
}

export const createBuckets = (provider : aws.Provider): S3Output => {
  const { bucket: asset, role: assetRole } = createAsset(provider)
  return { asset, assetRole }
}
