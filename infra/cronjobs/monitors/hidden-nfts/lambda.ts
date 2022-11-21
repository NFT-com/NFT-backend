import { join } from 'path'

import * as aws from '@pulumi/aws'
import * as pulumi from '@pulumi/pulumi'

import { getResourceName,getStage } from '../../../helper'

function relativeRootPath(path: string): string {
  return join(process.cwd(), '..', path)
}

/**
 * Globals
 */
const account = pulumi.output(aws.getCallerIdentity({ async: true })).accountId
const executionRoleName = getResourceName('role')
const lambdaFunctionName = getResourceName('monitor-hidden-nfts')

/**
 * IAM Role
 */
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
const rolePolicy = new aws.iam.RolePolicy(executionRolePolicyName, {
  name: executionRolePolicyName,
  role: executionRole,
  policy: {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Action: [
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:PutLogEvents',
        ],
        Resource: account.apply(
          (accountId) =>
            `arn:aws:logs:${aws.config.region}:${accountId}:log-group:/aws/lambda/${lambdaFunctionName}*`,
        ),
      },
      {
        'Effect': 'Allow',
        'Action': [
          /* VPC Access */
          'ec2:CreateNetworkInterface',
          'ec2:DeleteNetworkInterface',
          'ec2:DescribeNetworkInterfaces',
          /* CloudWatch Metric API */
          'cloudwatch:PutMetricData',
        ],
        'Resource': '*',
      },
    ],
  },
})

/**
 * Code Archive & Lambda layer
 */
const code = new pulumi.asset.AssetArchive({
  '.': new pulumi.asset.FileArchive(relativeRootPath('dist/cronjobs/monitors/archive.zip')),
})

const zipFile = relativeRootPath('layers/archive.zip')
const nodeModuleLambdaLayerName = getResourceName('lambda-layer-nodemodules-hidden-nfts')
const nodeModuleLambdaLayer = new aws.lambda.LayerVersion(
  nodeModuleLambdaLayerName,
  {
    compatibleRuntimes: [aws.lambda.Runtime.NodeJS16dX],
    code: new pulumi.asset.FileArchive(zipFile),
    layerName: nodeModuleLambdaLayerName,
  },
)

/**
 * Lambda Function
 */
const createLambdaFunction = new aws.lambda.Function(lambdaFunctionName, {
  name: lambdaFunctionName,
  runtime: aws.lambda.Runtime.NodeJS16dX,
  handler: 'hidden-nfts/main.handler',
  role: executionRole.arn,
  code,
  layers: [nodeModuleLambdaLayer.arn],
  memorySize: 256,
  timeout: 5,
  tags: {
    Environment: pulumi.getStack(),
  },
})
