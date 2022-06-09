import * as aws from '@pulumi/aws'
import * as pulumi from '@pulumi/pulumi'

import { SharedInfraOutput } from '../defs'
import { getResourceName } from '../helper'

const attachLBListeners = (
  lb: aws.lb.LoadBalancer,
  tg: aws.lb.TargetGroup,
): void => {
  new aws.lb.Listener('listener_http_dev_gql_ecs', {
    defaultActions: [
      {
        order: 1,
        redirect: {
          port: '443',
          protocol: 'HTTPS',
          statusCode: 'HTTP_301',
        },
        type: 'redirect',
      },
    ],
    loadBalancerArn: lb.arn,
    port: 80,
    protocol: 'HTTP',
  })

  new aws.lb.Listener('listener_https_dev_gql_ecs', {
    certificateArn:
      'arn:aws:acm:us-east-1:016437323894:certificate/0c01a3a8-59c4-463a-87ec-5c487695f09e',
    defaultActions: [
      {
        targetGroupArn: tg.arn,
        type: 'forward',
      },
    ],
    loadBalancerArn: lb.arn,
    port: 443,
    protocol: 'HTTPS',
    sslPolicy: 'ELBSecurityPolicy-2016-08',
  })
}

const createEcsTargetGroup = (
  infraOutput: SharedInfraOutput,
): aws.lb.TargetGroup => {
  return new aws.lb.TargetGroup('tg_gql_ecs', {
    healthCheck: {
      interval: 15,
      matcher: '200-399',
      path: '/.well-known/apollo/server-health',
      timeout: 5,
      unhealthyThreshold: 5,
    },
    name: getResourceName('gql-ecs'),
    port: 8080,
    protocol: 'HTTP',
    protocolVersion: 'HTTP1',
    stickiness: {
      enabled: false,
      type: 'lb_cookie',
    },
    targetType: 'ip',
    vpcId: infraOutput.vpcId,
  })
}

const createEcsLoadBalancer = (
  infraOutput: SharedInfraOutput,
): aws.lb.LoadBalancer => {
  return new aws.lb.LoadBalancer('lb_gql_ecs', {
    ipAddressType: 'ipv4',
    name: getResourceName('gql-ecs'),
    securityGroups: [infraOutput.webSGId],
    subnets: infraOutput.publicSubnets,
  })
}

const createEcsCluster = (): aws.ecs.Cluster => {
  const cluster = new aws.ecs.Cluster('cluster_gql', {
    name: getResourceName('gql'),
    settings: [
      {
        name: 'containerInsights',
        value: 'disabled',
      },
    ],
  })

  new aws.ecs.ClusterCapacityProviders('ccp_gql', {
    clusterName: cluster.name,
    capacityProviders: ['FARGATE'],
    defaultCapacityProviderStrategies: [
      {
        weight: 100,
        capacityProvider: 'FARGATE',
      },
    ],
  })

  return cluster
}

const createEcsTaskRole = (): aws.iam.Role => {
  const role = new aws.iam.Role('role_gql_ecs', {
    name: getResourceName('gql-ar.us-east-1'),
    description: 'Role for GQL ECS Task',
    assumeRolePolicy: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'sts:AssumeRole',
          Effect: 'Allow',
          Principal: {
            Service: 'ecs-tasks.amazonaws.com',
          },
        },
      ],
    },
  })

  const policy = new aws.iam.Policy('policy_gql_ecs_ssm', {
    policy: {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: [
            'ssmmessages:CreateControlChannel',
            'ssmmessages:CreateDataChannel',
            'ssmmessages:OpenControlChannel',
            'ssmmessages:OpenDataChannel',
          ],
          Resource: '*',
        },
      ],
    },
  })

  new aws.iam.RolePolicyAttachment('rpa_gql_ecs_ssm', {
    role: role.name,
    policyArn: policy.arn,
  })

  return role
}

const createEcsTaskDefinition = (
  config: pulumi.Config,
  gqlECRRepo: string,
): aws.ecs.TaskDefinition => {
  const ecrImage = `${process.env.ECR_REGISTRY}/${gqlECRRepo}:${process.env.GIT_SHA || 'latest'}`
  const role = createEcsTaskRole()

  return new aws.ecs.TaskDefinition(
    'dev-gql-td',
    {
      containerDefinitions: JSON.stringify([
        {
          essential: true,
          image: ecrImage,
          logConfiguration: {
            logDriver: 'awslogs',
            options: {
              'awslogs-group': '/ecs/dev-gql',
              'awslogs-region': 'us-east-1',
              'awslogs-stream-prefix': 'ecs',
            },
          },
          memoryReservation: parseInt(config.require('ecsTaskMemory')),
          name: getResourceName('gql'),
          portMappings: [
            { containerPort: 8080, hostPort: 8080, protocol: 'tcp' },
          ],
        },
      ]),
      cpu: config.require('ecsTaskCpu'),
      memory: config.require('ecsTaskMemory'),
      taskRoleArn: role.arn,
      executionRoleArn: 'arn:aws:iam::016437323894:role/ECSServiceTask',
      family: getResourceName('gql'),
      networkMode: 'awsvpc',
      requiresCompatibilities: ['FARGATE'],
      runtimePlatform: {
        operatingSystemFamily: 'LINUX',
      },
    },
    {
      dependsOn: [pulumi.output(role)],
    },
  )
}

const applyEcsServiceAutoscaling = (
  config: pulumi.Config,
  service: aws.ecs.Service,
): void => {
  const target = new aws.appautoscaling.Target('target_gql_ecs', {
    maxCapacity: parseInt(config.require('ecsAutoScaleMax')),
    minCapacity: parseInt(config.require('ecsAutoScaleMin')),
    resourceId: service.id.apply((id) => id.split(':').pop() || ''),
    scalableDimension: 'ecs:service:DesiredCount',
    serviceNamespace: 'ecs',
  })

  new aws.appautoscaling.Policy('policy_gql_ecs', {
    policyType: 'TargetTrackingScaling',
    resourceId: target.resourceId,
    scalableDimension: target.scalableDimension,
    serviceNamespace: target.serviceNamespace,
    targetTrackingScalingPolicyConfiguration: {
      targetValue: 60,
      predefinedMetricSpecification: {
        predefinedMetricType: 'ECSServiceAverageCPUUtilization',
      },
      scaleInCooldown: 360,
    },
  })
}

export const createEcsService = (
  config: pulumi.Config,
  infraOutput: SharedInfraOutput,
): void => {
  const cluster = createEcsCluster()
  const taskDefinition = createEcsTaskDefinition(config, infraOutput.gqlECRRepo)
  const targetGroup = createEcsTargetGroup(infraOutput)
  const loadBalancer = createEcsLoadBalancer(infraOutput)
  attachLBListeners(loadBalancer, targetGroup)

  const service = new aws.ecs.Service('svc_gql_ecs', {
    cluster: cluster.arn,
    deploymentCircuitBreaker: {
      enable: true,
      rollback: true,
    },
    enableEcsManagedTags: true,
    enableExecuteCommand: true,
    healthCheckGracePeriodSeconds: 20,
    launchType: 'FARGATE',
    loadBalancers: [
      {
        containerName: getResourceName('gql'),
        containerPort: 8080,
        targetGroupArn: targetGroup.arn,
      },
    ],
    name: getResourceName('gql'),
    networkConfiguration: {
      assignPublicIp: true,
      securityGroups: [infraOutput.webEcsSGId],
      subnets: infraOutput.publicSubnets,
    },
    taskDefinition: taskDefinition.arn,
  })

  applyEcsServiceAutoscaling(config, service)
}
