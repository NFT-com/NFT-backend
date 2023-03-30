import * as aws from '@pulumi/aws'

import { getResourceName, getTags } from '../../../helper'

const tags = {
  cronjob: 'monitor-hidden-nfts',
}

const createEventBridgeRule = (): aws.cloudwatch.EventRule => {
  const resourceName = getResourceName('monitorHiddenNFTs-eventRule')
  return new aws.cloudwatch.EventRule('monitorHiddenNFTs-eventRule', {
    name: resourceName,
    scheduleExpression: 'cron(2/5 * * * ? *)', // run every 5 minutes at *2 and *7 of the hour
    tags: getTags(tags),
  })
}

export const createMonitorHiddenNFTsEventBridgeTarget = (lambda: aws.lambda.Function): aws.cloudwatch.EventTarget => {
  const rule = createEventBridgeRule()

  new aws.lambda.Permission('name', {
    action: 'lambda:InvokeFunction',
    function: lambda.name,
    principal: 'events.amazonaws.com',
    sourceArn: rule.arn,
  })

  return new aws.cloudwatch.EventTarget(
    'monitorHiddenNFTs-eventTarget',
    {
      arn: lambda.arn,
      rule: rule.name,
    },
    {
      deleteBeforeReplace: true,
    },
  )
}
