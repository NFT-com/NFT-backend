import * as aws from '@pulumi/aws'

import { getResourceName, getTags } from '../../helper'

const tags = {
  cronjob: 'dbsync',
}

const execRole = 'arn:aws:iam::016437323894:role/ecsTaskExecutionRole'
const taskRole = 'arn:aws:iam::016437323894:role/ECSServiceTask'

export const createDBSyncTaskDefinition = (): aws.ecs.TaskDefinition => {
  const resourceName = getResourceName('dbsync')
  const ecrImage = `${process.env.ECR_REGISTRY}/dbsync:${process.env.GIT_SHA || 'latest'}`

  return new aws.ecs.TaskDefinition('dbsync-td', {
    containerDefinitions: JSON.stringify([
      {
        command: [],
        cpu: 0,
        logConfiguration: {
          logDriver: 'awslogs',
          options: {
            'awslogs-create-group': 'True',
            'awslogs-group': '/cronjobs/dbsync',
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
        portMappings: [
          {
            containerPort: 80,
            hostPort: 80,
            protocol: 'tcp',
          },
        ],
        environment: [
          {
            Name: 'STAGING_DB_HOST',
            Value: process.env.STG_GQL_DB_HOST, //need to hardcode given need access to both prod/staging for this job
          },
          {
            Name: 'STAGING_DB_PASS',
            Value: process.env.STG_GQL_DB_PASSWORD,
          },
          {
            Name: 'PROD_DB_HOST',
            Value: process.env.GQL_DB_HOST, //only run on prod, so GQL_DB lines up to prod in this case
          },
          {
            Name: 'PROD_DB_PASS',
            Value: process.env.GQL_DB_PASSWORD,
          },
          {
            Name: 'AWS_ACCESS_KEY',
            Value: process.env.AWS_ACCESS_KEY,
          },
          {
            Name: 'AWS_SECRET_ACCESS_KEY',
            Value: process.env.AWS_SECRET_ACCESS_KEY,
          },
          {
            Name: 'AWS_REGION',
            Value: process.env.AWS_REGION,
          },
          {
            Name: 'PROD_DB_BASTION_CONN',
            Value: process.env.PROD_DB_BASTION_CONN, // needed to connect to prod db
          },
          {
            Name: 'PROD_DB_SSH_KEY',
            Value: process.env.PROD_DB_SSH_KEY, // key to access bastion host to connect to prod db
          },
        ],
        volumesFrom: [],
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

export const createDBSyncEcsCluster = (): aws.ecs.Cluster => {
  const resourceName = 'cronjob-dbsync'
  const cluster = new aws.ecs.Cluster('dbsync-cluster', {
    name: resourceName,
    settings: [
      {
        name: 'containerInsights',
        value: 'enabled',
      },
    ],
    capacityProviders: ['FARGATE_SPOT', 'FARGATE'],
    configuration: {
      executeCommandConfiguration: {
        logging: 'DEFAULT',
      },
    },
    tags: {
      cronjob: 'dbsync',
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
