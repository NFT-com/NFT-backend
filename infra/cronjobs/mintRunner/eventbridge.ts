import * as aws from '@pulumi/aws'

import { getResourceName } from '../../helper'

const createEventBridgeRule = (): aws.cloudwatch.EventRule => {
  const resourceName = getResourceName('mintRunner-eventRule')
  return new aws.cloudwatch.EventRule('mintRunner-eventRule', {
    name: resourceName,
    scheduleExpression: 'cron(05 09 * * ? *)',  // run daily at 09:05 UTC 
  })
}

const createEventBridgeRole = (): aws.iam.Role => {
  const resourceName = getResourceName('mintRunner-eventRole')
  return new aws.iam.Role('mintRunner-eventRole', {
    assumeRolePolicy: JSON.stringify({
      Version: '2012-10-17',
      Statement: [{
        Action: 'sts.AssumeRole',
        Effect: 'Allow',
        Sid: '',
        Principal: {
          Service: 'events.amazon.com',
        },
      }],
    }),
    inlinePolicies: [{}],
    name: resourceName,
  })
}

export const createEventBridgeTarget = (
  taskDef: aws.ecs.TaskDefinition,
  subnets: string[],
  cluster: aws.ecs.Cluster,
): aws.cloudwatch.EventTarget => {
  const role = createEventBridgeRole()
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
      maximumRetryAttempts: 2,
    },
    roleArn: role.name,
    rule: rule.name,
  })
}
