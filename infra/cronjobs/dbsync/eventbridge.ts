import * as aws from '@pulumi/aws'

import { getResourceName, getTags } from '../../helper'

const tags = {
  cronjob: 'dbsync',
}

const createEventBridgeRule = (): aws.cloudwatch.EventRule => {
  const resourceName = getResourceName('dbsync-eventRule')
  return new aws.cloudwatch.EventRule('dbsync-eventRule', {
    name: resourceName,
    scheduleExpression: 'cron(05 09 ? * 1 *)', // run sundays at 0905 UTC
    tags: getTags(tags),
  })
}

export const createDBSyncEventBridgeTarget = (
  taskDef: aws.ecs.TaskDefinition,
  subnets: string[],
  cluster: aws.ecs.Cluster,
): aws.cloudwatch.EventTarget => {
  const rule = createEventBridgeRule()

  return new aws.cloudwatch.EventTarget('dbsync-eventTarget', {
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
