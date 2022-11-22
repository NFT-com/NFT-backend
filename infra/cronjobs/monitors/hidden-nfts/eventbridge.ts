import * as aws from '@pulumi/aws'

import { getResourceName, getTags, isProduction } from '../../../helper'

const tags = {
  cronjob: 'monitor-hidden-nfts',
}

const createEventBridgeRule = (): aws.cloudwatch.EventRule => {
  const resourceName = getResourceName('monitorHiddenNFTs-eventRule')
  return new aws.cloudwatch.EventRule('monitorHiddenNFTs-eventRule', {
    name: resourceName,
    scheduleExpression: isProduction() ? 'cron(00 05 * * ? *)' : 'cron(00 05 1 * ? *)',  // if prod, run daily at 05:00 UTC, otherwise 1x monthly
    tags: getTags(tags),
  })
}

export const createMonitorHiddenNFTsEventBridgeTarget = (
  lambda: aws.lambda.Function,
): aws.cloudwatch.EventTarget => {
  const rule = createEventBridgeRule()

  return new aws.cloudwatch.EventTarget('monitorHiddenNFTs-eventTarget', {
    arn: lambda.arn,
    rule: rule.name,
  }, {
    deleteBeforeReplace: true,
  })
}
