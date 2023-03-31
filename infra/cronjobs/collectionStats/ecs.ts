import * as aws from '@pulumi/aws'

import { getResourceName, getTags } from '../../helper'

const tags = {
  cronjob: 'collection-stats',
}

const execRole = 'arn:aws:iam::016437323894:role/ecsTaskExecutionRole'
const taskRole = 'arn:aws:iam::016437323894:role/ECSServiceTask'

export const createCollectionStatsTaskDefinition = (): aws.ecs.TaskDefinition => {
  const resourceName = getResourceName('collectionStats')
  const ecrImage = `${process.env.ECR_REGISTRY}/collection-stats:${process.env.STAGE}-${
    process.env.GIT_SHA || 'latest'
  }`

  return new aws.ecs.TaskDefinition('collectionStats-td', {
    containerDefinitions: JSON.stringify([
      {
        logConfiguration: {
          logDriver: 'awslogs',
          options: {
            'awslogs-create-group': 'True',
            'awslogs-group': `/cronjobs/${process.env.STAGE}-collection-stats`,
            'awslogs-region': 'us-east-1',
            'awslogs-stream-prefix': 'cronjobs',
          },
        },
        essential: true,
        image: ecrImage,
        memoryReservation: 1024,
        name: resourceName,
        environment: [
          {
            Name: 'DB_HOST',
            Value: process.env.GQL_DB_HOST,
          },
          {
            Name: 'DB_PORT',
            Value: process.env.GQL_DB_PORT,
          },
          {
            Name: 'DB_PASSWORD',
            Value: process.env.GQL_DB_PASSWORD,
          },
          {
            Name: 'DB_USE_SSL',
            Value: process.env.GQL_DB_USE_SSL,
          },
          {
            Name: 'REDIS_HOST',
            Value: process.env.REDIS_HOST,
          },
          {
            Name: 'REDIS_PORT',
            Value: process.env.REDIS_PORT,
          },
          {
            Name: 'NFTPORT_KEY',
            Value: process.env.NFTPORT_KEY,
          },
          {
            Name: 'NODE_ENV',
            Value: process.env.NODE_ENV,
          },
        ],
      },
    ]),
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

export const createCollectionStatsEcsCluster = (): aws.ecs.Cluster => {
  const resourceName = 'cronjob-collection-stats' // static name to allow each env to share the same ecs cluster
  const cluster = new aws.ecs.Cluster('collectionStats-cluster', {
    name: resourceName,
    settings: [
      {
        name: 'containerInsights',
        value: 'disabled',
      },
    ],
    capacityProviders: ['FARGATE_SPOT', 'FARGATE'],
    configuration: {
      executeCommandConfiguration: {
        logging: 'DEFAULT',
      },
    },
    tags: {
      cronjob: 'collection-stats',
    },
    defaultCapacityProviderStrategies: [
      {
        capacityProvider: 'FARGATE',
        weight: 1,
      },
    ],
  })

  return cluster
}
