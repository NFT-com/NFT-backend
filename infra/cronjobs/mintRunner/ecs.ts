import * as aws from '@pulumi/aws'

import { getResourceName, getTags } from '../../helper'

const tags = {
  cronjob: 'mintrunner',
}

const execRole = 'arn:aws:iam::016437323894:role/ecsTaskExecutionRole'
const taskRole = 'arn:aws:iam::016437323894:role/ECSServiceTask'

export const createMintRunnerTaskDefinition = (): aws.ecs.TaskDefinition => {
  const resourceName = getResourceName('mintRunner')
  const ecrImage = `${process.env.ECR_REGISTRY}/mintrunner:${process.env.STAGE}-${process.env.GIT_SHA || 'latest'}`

  return new aws.ecs.TaskDefinition('mintRunner-td', {
    containerDefinitions: JSON.stringify([
      {
        command: [],
        cpu: 0,
        logConfiguration: {
          logDriver: 'awslogs',
          options: {
            'awslogs-create-group': 'True',
            'awslogs-group': `/cronjobs/${process.env.STAGE}-mintrunner`,
            'awslogs-region': 'us-east-1',
            'awslogs-stream-prefix': 'cronjobs',
          },
        },
        entryPoint: [],
        essential: true,
        image: ecrImage,
        links: [],
        memoryReservation: 1024,
        mountPoints: [],
        name: resourceName,
        portMappings: [{
          containerPort: 80,
          hostPort: 80,
          protocol: 'tcp',
        }],
        environment: [
          {
            Name: 'DB_HOST',
            Value: process.env.ANALYTICS_DB_HOST,
          },
          {
            Name: 'DB_NAME',
            Value: process.env.ANALYTICS_DB_NAME,
          },
          {
            Name: 'DB_PASS',
            Value: process.env.ANALYTICS_DB_PASS,
          },
          {
            Name: 'DB_PORT',
            Value: process.env.ANALYTICS_DB_PORT,
          },
          {
            Name: 'DB_USER',
            Value: process.env.ANALYTICS_DB_USER,
          },
          {
            Name: 'ETHERSCAN_API_KEY',
            Value: process.env.ETHERSCAN_API_KEY,
          },
          {
            Name: 'ETH_NODE_URL',
            Value: process.env.ETH_NODE_URL,
          },
          {
            Name: 'PROFILE_PER_GK',
            Value: process.env.PROFILE_PER_GK,
          },
          {
            Name: 'MINT_TABLE_NAME',
            Value: process.env.MINT_TABLE_NAME,
          },
          {
            Name: 'ENV',
            Value: process.env.ENV,
          },
        ],
        volumesFrom: [],
      }]),
    cpu: '512',
    executionRoleArn: execRole,
    family: resourceName,
    memory: '1024',
    networkMode: 'awsvpc',
    requiresCompatibilities: ['FARGATE'],
    runtimePlatform: {
      operatingSystemFamily: 'LINUX',
    },
    taskRoleArn: taskRole,
    tags: getTags(tags),
  })
}

export const createEcsCluster = (): aws.ecs.Cluster => {
  const resourceName = 'cronjob-mintrunner' // static name to allow each env to share the same ecs cluster
  const cluster = new aws.ecs.Cluster('mintRunner-cluster',
    {
      name: resourceName,
      settings: [
        {
          name: 'containerInsights',
          value: 'disabled',
        }],
      capacityProviders: [
        'FARGATE_SPOT',
        'FARGATE',
      ],
      configuration: {
        executeCommandConfiguration: {
          logging: 'DEFAULT',
        },
      },
      tags: {
        cronjob: 'mintrunner',
      },
      defaultCapacityProviderStrategies: [{
        capacityProvider: 'FARGATE',
        weight: 1,
      }],
    })

  return cluster
}
