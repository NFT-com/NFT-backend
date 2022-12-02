import * as aws from '@pulumi/aws'
import * as pulumi from '@pulumi/pulumi'

import { SharedInfraOutput } from '../defs'
import { getResourceName, getTags } from '../helper'

const tags = {
  service: 'gql',
}

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
    tags: getTags(tags),
  })

  new aws.lb.Listener('listener_https_dev_gql_ecs', {
    certificateArn:
      'arn:aws:acm:us-east-1:016437323894:certificate/44dc39c0-4231-41f6-8f27-03029bddfa8e',
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
    tags: getTags(tags),
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
    tags: getTags(tags),
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
    tags: getTags(tags),
  })
}

const createEcsCluster = (): aws.ecs.Cluster => {
  const cluster = new aws.ecs.Cluster('cluster_gql', {
    name: getResourceName('gql'),
    settings: [
      {
        name: 'containerInsights',
        value: 'enabled',
      },
    ],
    tags: getTags(tags),
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
    tags: getTags(tags),
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
            'logs:CreateLogGroup',
            'logs:CreateLogStream',
            'logs:PutLogEvents',
            'logs:DescribeLogStreams',
            'logs:DescribeLogGroups',
            'ssm:GetParameters',
          ],
          Resource: '*',
        },
      ],
    },
    tags: getTags(tags),
  })

  new aws.iam.RolePolicyAttachment('rpa_gql_ecs_ssm', {
    role: role.name,
    policyArn: policy.arn,
  })

  return role
}

const createAOTCollectorSSMParameter = (): aws.ssm.Parameter => {
  return new aws.ssm.Parameter('otel-collector-config', {
    name: getResourceName('otel-collector-config'),
    type: 'String',
    value: `extensions:
  health_check:
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch/traces:
    timeout: 1s
    send_batch_size: 50
  resourcedetection:
    detectors:
      - env
      - system
      - ecs

exporters:
  otlp/traces:
    endpoint: "\${OTLP_COLLECTOR_ENDPOINT}"
    headers:
      "x-honeycomb-team": "\${HONEYCOMB_API_KEY}"
  datadog:
    api:
      key: "\${DATADOG_API_KEY}"

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [resourcedetection, batch/traces]
      exporters: [datadog/api, otlp/traces]
  extensions: [health_check]`,
  })
}

const createEcsTaskDefinition = (
  config: pulumi.Config,
  gqlECRRepo: string,
): aws.ecs.TaskDefinition => {
  const ecrImage = `${process.env.ECR_REGISTRY}/${gqlECRRepo}:${process.env.GIT_SHA || 'latest'}`
  const role = createEcsTaskRole()
  const resourceName = getResourceName('gql')
  const ssmParam = createAOTCollectorSSMParameter()

  return new aws.ecs.TaskDefinition(
    'gql-td',
    {
      containerDefinitions: pulumi.all([ssmParam.arn])
        .apply(([ssmParamArn]) => {
          return JSON.stringify([
            {
              essential: true,
              image: ecrImage,
              logConfiguration: {
                logDriver: 'awsfirelens',
                options: {
                  Name: 'cloudwatch_logs',
                  region: 'us-east-1',
                  log_key: 'log',
                  log_group_name: `/ecs/${resourceName}`,
                  log_stream_prefix: 'gql/',
                  auto_create_group: 'true',
                },
              },
              name: resourceName,
              portMappings: [
                { containerPort: 8080, hostPort: 8080, protocol: 'tcp' },
              ],
              environment: [
                {
                  Name: 'STAGE',
                  Value: process.env.STAGE,
                },
                {
                  Name: 'PULUMI_CONFIG_PASSPHRASE',
                  Value: process.env.PULUMI_CONFIG_PASSPHRASE,
                },
                {
                  Name: 'AWS_ACCOUNT_ID',
                  Value: process.env.AWS_ACCOUNT_ID,
                },
                {
                  Name: 'ECR_REGISTRY',
                  Value: process.env.ECR_REGISTRY,
                },
                {
                  Name: 'GIT_SHA',
                  Value: process.env.GIT_SHA,
                },
                {
                  Name: 'DB_HOST',
                  Value: process.env.DB_HOST,
                },
                {
                  Name: 'DB_HOST_RO',
                  Value: process.env.DB_HOST_RO,
                },
                {
                  Name: 'DB_USE_SSL',
                  Value: process.env.DB_USE_SSL,
                },
                {
                  Name: 'DB_PASSWORD',
                  Value: process.env.DB_PASSWORD,
                },
                {
                  Name: 'DB_PORT',
                  Value: process.env.DB_PORT,
                },
                {
                  Name: 'CHAIN_ID',
                  Value: process.env.CHAIN_ID,
                },
                {
                  Name: 'AUTH_MESSAGE',
                  Value: process.env.AUTH_MESSAGE,
                },
                {
                  Name: 'SG_API_KEY',
                  Value: process.env.SG_API_KEY,
                },
                {
                  Name: 'CONFIRM_EMAIL_URL',
                  Value: process.env.CONFIRM_EMAIL_URL,
                },
                {
                  Name: 'ETH_GAS_STATION_API_KEY',
                  Value: process.env.ETH_GAS_STATION_API_KEY,
                },
                {
                  Name: 'TEAM_AUTH_TOKEN',
                  Value: process.env.TEAM_AUTH_TOKEN,
                },
                {
                  Name: 'MNEMONIC',
                  Value: process.env.MNEMONIC,
                },
                {
                  Name: 'MNEMONIC_RINKEBY',
                  Value: process.env.MNEMONIC_RINKEBY,
                },
                {
                  Name: 'HCS_TOPIC_ID',
                  Value: process.env.HCS_TOPIC_ID,
                },
                {
                  Name: 'HCS_ACCOUNT_ID',
                  Value: process.env.HCS_ACCOUNT_ID,
                },
                {
                  Name: 'HCS_PRIVATE_KEY',
                  Value: process.env.HCS_PRIVATE_KEY,
                },
                {
                  Name: 'ZMOK_API_URL',
                  Value: process.env.ZMOK_API_URL,
                },
                {
                  Name: 'INFURA_API_KEY',
                  Value: process.env.INFURA_API_KEY,
                },
                {
                  Name: 'ALCHEMY_API_KEY',
                  Value: process.env.ALCHEMY_API_KEY,
                },
                {
                  Name: 'ALCHEMY_API_URL',
                  Value: process.env.ALCHEMY_API_URL,
                },
                {
                  Name: 'ALCHEMY_API_URL_GOERLI',
                  Value: process.env.ALCHEMY_API_URL_GOERLI,
                },
                {
                  Name: 'SENTRY_DSN',
                  Value: process.env.SENTRY_DSN,
                },
                {
                  Name: 'PUBLIC_SALE_KEY',
                  Value: process.env.PUBLIC_SALE_KEY,
                },
                {
                  Name: 'SERVER_CONFIG',
                  Value: process.env.SERVER_CONFIG,
                },
                {
                  Name: 'SHARED_MINT_SECRET',
                  Value: process.env.SHARED_MINT_SECRET,
                },
                {
                  Name: 'SUPPORTED_NETWORKS',
                  Value: process.env.SUPPORTED_NETWORKS,
                },
                {
                  Name: 'TYPESENSE_HOST',
                  Value: process.env.TYPESENSE_HOST,
                },
                {
                  Name: 'TYPESENSE_API_KEY',
                  Value: process.env.TYPESENSE_API_KEY,
                },
                {
                  Name: 'MINTED_PROFILE_EVENTS_MAX_BLOCKS',
                  Value: process.env.MINTED_PROFILE_EVENTS_MAX_BLOCKS,
                },
                {
                  Name: 'PROFILE_NFTS_EXPIRE_DURATION',
                  Value: process.env.PROFILE_NFTS_EXPIRE_DURATION,
                },
                {
                  Name: 'BULL_MAX_REPEAT_COUNT',
                  Value: process.env.BULL_MAX_REPEAT_COUNT,
                },
                {
                  Name: 'OPENSEA_API_KEY',
                  Value: process.env.OPENSEA_API_KEY,
                },
                {
                  Name: 'OPENSEA_ORDERS_API_KEY',
                  Value: process.env.OPENSEA_ORDERS_API_KEY,
                },
                {
                  Name: 'LOOKSRARE_API_KEY',
                  Value: process.env.LOOKSRARE_API_KEY,
                },
                {
                  Name: 'PROFILE_SCORE_EXPIRE_DURATION',
                  Value: process.env.PROFILE_SCORE_EXPIRE_DURATION,
                },
                {
                  Name: 'NFT_EXTERNAL_ORDER_REFRESH_DURATION',
                  Value: process.env.NFT_EXTERNAL_ORDER_REFRESH_DURATION,
                },
                {
                  Name: 'TEST_DB_HOST',
                  Value: process.env.TEST_DB_HOST,
                },
                {
                  Name: 'TEST_DB_DATABASE',
                  Value: process.env.TEST_DB_DATABASE,
                },
                {
                  Name: 'TEST_DB_USERNAME',
                  Value: process.env.TEST_DB_USERNAME,
                },
                {
                  Name: 'TEST_DB_PORT',
                  Value: process.env.TEST_DB_PORT,
                },
                {
                  Name: 'TEST_DB_PASSWORD',
                  Value: process.env.TEST_DB_PASSWORD,
                },
                {
                  Name: 'TEST_DB_USE_SSL',
                  Value: process.env.TEST_DB_USE_SSL,
                },
                {
                  Name: 'ACTIVITY_ENDPOINTS_ENABLED',
                  Value: process.env.ACTIVITY_ENDPOINTS_ENABLED,
                },
                {
                  Name: 'NFTPORT_KEY',
                  Value: process.env.NFTPORT_KEY,
                },
                {
                  Name: 'REFRESH_NFT_DURATION',
                  Value: process.env.REFRESH_NFT_DURATION,
                },
                {
                  Name: 'IPFS_WEB_GATEWAY',
                  Value: process.env.IPFS_WEB_GATEWAY,
                },
                {
                  Name: 'DEFAULT_TTL_MINS',
                  Value: process.env.DEFAULT_TTL_MINS,
                },
                {
                  Name: 'ASSET_BUCKET',
                  Value: process.env.ASSET_BUCKET,
                },
                {
                  Name: 'ASSET_BUCKET_ROLE',
                  Value: process.env.ASSET_BUCKET_ROLE,
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
                  Name: 'PORT',
                  Value: process.env.PORT,
                },
                {
                  Name: 'AUTH_EXPIRE_BY_DAYS',
                  Value: process.env.AUTH_EXPIRE_BY_DAYS,
                },
                {
                  Name: 'NODE_ENV',
                  Value: process.env.NODE_ENV,
                },
              ],
              dependsOn: [
                {
                  containerName: getResourceName('aws-otel-collector'),
                  condition: 'START',
                },
              ],
            },
            {
              name: getResourceName('log-router'),
              image: '016437323894.dkr.ecr.us-east-1.amazonaws.com/aws-for-fluentbit:stable',
              essential: true,
              firelensConfiguration: {
                type: 'fluentbit',
                options: {
                  'enable-ecs-log-metadata': 'false',
                },
              },
            },
            {
              name: getResourceName('aws-otel-collector'),
              image: 'amazon/aws-otel-collector',
              essential: true,
              environment: [
                {
                  Name: 'OTLP_COLLECTOR_ENDPOINT',
                  Value: 'api.honeycomb.io:443',
                },
                {
                  Name: 'HONEYCOMB_API_KEY',
                  Value: process.env.HONEYCOMB_API_KEY,
                },
                {
                  Name: 'DATADOG_API_KEY',
                  Value: process.env.DATADOG_API_KEY,
                },
              ],
              secrets: [
                {
                  Name: 'AOT_CONFIG_CONTENT',
                  ValueFrom: ssmParamArn,
                },
              ],
              logConfiguration: {
                logDriver: 'awslogs',
                options: {
                  'awslogs-group': '/ecs/ecs-aws-otel-sidecar-collector',
                  'awslogs-region': 'us-east-1',
                  'awslogs-stream-prefix': 'ecs',
                  'awslogs-create-group': 'True',
                },
              },
              healthCheck: {
                command: ['/healthcheck'],
                interval: 5,
                timeout: 6,
                retries: 5,
                startPeriod: 1,
              },
            },
          ])
        }),
      cpu: config.require('ecsTaskCpu'),
      memory: config.require('ecsTaskMemory'),
      taskRoleArn: role.arn,
      executionRoleArn: 'arn:aws:iam::016437323894:role/ECSServiceTask',
      family: resourceName,
      networkMode: 'awsvpc',
      requiresCompatibilities: ['FARGATE'],
      runtimePlatform: {
        operatingSystemFamily: 'LINUX',
      },
      tags: getTags(tags),
    },
    {
      dependsOn: [
        pulumi.output(role),
        pulumi.output(ssmParam),
      ],
    },
  )
}

const applyEcsServiceAutoscaling = (
  config: pulumi.Config,
  service: aws.ecs.Service,
): void => {
  const target = new aws.appautoscaling.Target('target_gql_ecs', {
    maxCapacity: config.requireNumber('ecsAutoScaleMax'),
    minCapacity: config.requireNumber('ecsAutoScaleMin'),
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
    desiredCount: config.requireNumber('ecsAutoScaleMin'),
    enableEcsManagedTags: true,
    enableExecuteCommand: true,
    forceNewDeployment: true,
    healthCheckGracePeriodSeconds: 40,
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
    tags: getTags(tags),
  })

  applyEcsServiceAutoscaling(config, service)
}
