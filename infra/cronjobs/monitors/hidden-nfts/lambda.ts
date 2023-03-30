import { join } from 'path'

import * as aws from '@pulumi/aws'
import * as pulumi from '@pulumi/pulumi'

import { getResourceName, getStage } from '../../../helper'

function relativeRootPath(path: string): string {
  return join(process.cwd(), '..', path)
}

/**
 * IAM Role
 */
const createIAMRole = (account: pulumi.Output<string>, lambdaFunctionName: string): aws.iam.Role => {
  const executionRoleName = getResourceName('monitorHiddenNFTs-role')
  const executionRole = new aws.iam.Role(executionRoleName, {
    name: executionRoleName,
    assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
      Service: 'lambda.amazonaws.com',
    }),
    tags: {
      Environment: getStage(),
    },
  })
  const executionRolePolicyName = `${executionRoleName}-policy`
  /* Create Role Policy for Role */
  new aws.iam.RolePolicy(executionRolePolicyName, {
    name: executionRolePolicyName,
    role: executionRole,
    policy: {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
          Resource: account.apply(
            accountId => `arn:aws:logs:${aws.config.region}:${accountId}:log-group:/aws/lambda/${lambdaFunctionName}*`,
          ),
        },
        {
          Effect: 'Allow',
          Action: [
            /* VPC Access */
            'ec2:CreateNetworkInterface',
            'ec2:DeleteNetworkInterface',
            'ec2:DescribeNetworkInterfaces',
            /* CloudWatch Metric API */
            'cloudwatch:PutMetricData',
          ],
          Resource: '*',
        },
      ],
    },
  })
  return executionRole
}

/**
 * Code Archive & Lambda layer
 */
const bundleAssets = (): any[] => {
  const code = new pulumi.asset.AssetArchive({
    '.': new pulumi.asset.FileArchive(relativeRootPath('dist/cronjobs/monitors/archive.zip')),
  })

  const zipFile = relativeRootPath('layers/archive.zip')
  const nodeModuleLambdaLayerName = getResourceName('lambda-layer-nodemodules-monitorHiddenNFTs')
  const nodeModuleLambdaLayer = new aws.lambda.LayerVersion(nodeModuleLambdaLayerName, {
    compatibleRuntimes: [aws.lambda.Runtime.NodeJS16dX],
    code: new pulumi.asset.FileArchive(zipFile),
    layerName: nodeModuleLambdaLayerName,
  })
  return [code, nodeModuleLambdaLayer]
}

/**
 * Lambda Function
 */
export const createMonitorHiddenNftsLambdaFunction = (
  securityGroupIds: string[],
  subnetIds: string[],
): aws.lambda.Function => {
  const account = pulumi.output(aws.getCallerIdentity({ async: true })).accountId
  const lambdaFunctionName = getResourceName('monitorHiddenNFTs')
  const executionRole = createIAMRole(account, lambdaFunctionName)
  const [code, nodeModuleLambdaLayer] = bundleAssets()

  return new aws.lambda.Function(lambdaFunctionName, {
    name: lambdaFunctionName,
    runtime: aws.lambda.Runtime.NodeJS16dX,
    handler: 'hidden-nfts/main.handler',
    role: executionRole.arn,
    code,
    layers: [nodeModuleLambdaLayer.arn],
    memorySize: 512,
    timeout: 5,
    environment: {
      variables: {
        DB_HOST: process.env.GQL_DB_HOST || '',
        DB_HOST_RO: process.env.GQL_DB_HOST_RO || '',
        DB_PORT: process.env.GQL_DB_PORT || '5432',
        DB_PASSWORD: process.env.GQL_DB_PASSWORD || 'password',
        DB_USE_SSL: process.env.GQL_DB_USE_SSL || '',
        NODE_ENV: process.env.NODE_ENV || 'development',
      },
    },
    vpcConfig: {
      securityGroupIds,
      subnetIds,
    },
    tags: {
      Environment: pulumi.getStack(),
    },
  })
}
