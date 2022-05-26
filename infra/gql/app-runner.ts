import * as process from 'process'

import * as aws from '@pulumi/aws'

import { SharedInfraOutput } from '../defs'
import { getEnv, getResourceName } from '../helper'

const createArRole = (): aws.iam.Role => {
  const role = new aws.iam.Role('role_gql_ar', {
    name: getResourceName('gql-ar.us-east-1'),
    description: 'Role for GQL AppRunner',
    assumeRolePolicy: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'sts:AssumeRole',
          Effect: 'Allow',
          Principal: {
            Service: 'build.apprunner.amazonaws.com',
          },
        },
      ],
    },
  })

  new aws.iam.RolePolicyAttachment('policy_gql_ar_ecr', {
    role: role.name,
    policyArn: 'arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess',
  })

  return role
}

const createArVpcConnector = (infraOutput: SharedInfraOutput): aws.apprunner.VpcConnector => {
  const connector = new aws.apprunner.VpcConnector('connector', {
    securityGroups: [
      infraOutput.webSGId,
    ],
    subnets: infraOutput.publicSubnets
    ,
    vpcConnectorName: 'gql_ar_vpc_connector',
  })

  return connector
}

export const createArService = (infraOutput: SharedInfraOutput): aws.apprunner.Service => {
  const arRole = createArRole()
  const arVpcConnector = createArVpcConnector(infraOutput)
  const ecrImage = `${process.env.ECR_REGISTRY}/${infraOutput.gqlECRRepo}:latest`

  const service = new aws.apprunner.Service('gql_ar_service', {
    serviceName: 'gql_ar_service',
    sourceConfiguration: {
      imageRepository: {
        imageConfiguration: {
          port: '8080',
          runtimeEnvironmentVariables: getEnv('gql').parsedFile,
        },
        imageIdentifier: ecrImage,
        imageRepositoryType: 'ECR',
      },
      authenticationConfiguration: {
        accessRoleArn: arRole.arn,
      },
    },
    networkConfiguration: {
      egressConfiguration: {
        egressType: 'VPC',
        vpcConnectorArn: arVpcConnector.arn,
      },
    },
  })

  return service
}