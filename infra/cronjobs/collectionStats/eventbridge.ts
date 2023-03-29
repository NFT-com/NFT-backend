import * as aws from '@pulumi/aws'

import { getResourceName, getTags, isProduction } from '../../helper'

const tags = {
  cronjob: 'collection-stats',
}

const createEventBridgeRule = (): aws.cloudwatch.EventRule => {
  const resourceName = getResourceName('collectionStats-eventRule')
  return new aws.cloudwatch.EventRule('collectionStats-eventRule', {
    name: resourceName,
    scheduleExpression: isProduction() ? 'cron(00 * * * ? *)' : 'cron(15 05 * * ? *)', // if prod, run hourly, otherwise at 05:15 daily
    tags: getTags(tags),
  })
}

export const createCollectionStatsEventBridgeTarget = (
  taskDef: aws.ecs.TaskDefinition,
  subnets: string[],
  sgId: string,
  cluster: aws.ecs.Cluster,
): aws.cloudwatch.EventTarget => {
  const rule = createEventBridgeRule()

  return new aws.cloudwatch.EventTarget(
    'collectionStats-eventTarget',
    {
      arn: cluster.arn,
      ecsTarget: {
        enableEcsManagedTags: true,
        enableExecuteCommand: true,
        launchType: 'FARGATE',
        networkConfiguration: {
          assignPublicIp: true,
          subnets: subnets,
          securityGroups: [sgId],
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
    },
    {
      deleteBeforeReplace: true,
    },
  )
}
