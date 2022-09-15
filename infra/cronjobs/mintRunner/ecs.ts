import * as aws from '@pulumi/aws'

import { getResourceName } from '../../helper'

const execRole = 'arn:aws:iam::016437323894:role/ecsTaskExecutionRole'
const taskRole = 'arn:aws:iam::016437323894:role/ECSServiceTask'

export const createMintRunnerTaskDefinition = (): aws.ecs.TaskDefinition => {
  const resourceName = getResourceName('mintRunner')
  const ecrImage = `${process.env.ECR_REGISTRY}/${process.env.STAGE}-mintrunner:${process.env.GIT_SHA || 'latest'}`
    
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
  })
}

export const createEcsCluster = (): aws.ecs.Cluster => {
  const resourceName = getResourceName('mintRunner')
  const cluster = new aws.ecs.Cluster('mintRunner-cluster',
    {
      name: resourceName,
      settings: [
        {
          name: 'containerInsights',
          value: 'enabled',
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
      defaultCapacityProviderStrategies: [{
        capacityProvider: 'FARGATE',
        weight: 1,
      }],
    })

  return cluster
}
