import * as aws from '@pulumi/aws'

import { getResourceName, getTags, isProduction } from '../../helper'

const tags = {
  cronjob: 'mintrunner',
}

const createEventBridgeRule = (): aws.cloudwatch.EventRule => {
  const resourceName = getResourceName('mintRunner-eventRule')
  return new aws.cloudwatch.EventRule('mintRunner-eventRule', {
    name: resourceName,
    scheduleExpression: isProduction() ? 'cron(05 09 * * ? *)' : 'cron(05 09 1 * ? *)', // if prod, run daily at 09:05 UTC, otherwise 1x monthly
    tags: getTags(tags),
  })
}

export const createEventBridgeTarget = (
  taskDef: aws.ecs.TaskDefinition,
  subnets: string[],
  cluster: aws.ecs.Cluster,
): aws.cloudwatch.EventTarget => {
  const rule = createEventBridgeRule()

  return new aws.cloudwatch.EventTarget('mintRunner-eventTarget', {
    arn: cluster.arn,
    ecsTarget: {
      enableEcsManagedTags: true,
      enableExecuteCommand: true,
      launchType: 'FARGATE',
      networkConfiguration: {
        assignPublicIp: true,
        subnets: subnets,
      },
      taskDefinitionArn: taskDef.arn,
    },
    retryPolicy: {
      maximumEventAgeInSeconds: 600,
      maximumRetryAttempts: 2,
    },
    // hardcoded iam role for eventbridge to trigger ecs
    roleArn: 'arn:aws:iam::016437323894:role/service-role/Amazon_EventBridge_Invoke_ECS_306739191',
    rule: rule.name,
  })
}
