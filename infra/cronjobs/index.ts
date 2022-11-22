import * as process from 'process'
import * as upath from 'upath'

import * as pulumi from '@pulumi/pulumi'

import { deployInfra, getStage, isProduction } from '../helper'
import { createCollectionStatsEcsCluster, createCollectionStatsTaskDefinition } from './collectionStats/ecs'
import { createCollectionStatsEventBridgeTarget } from './collectionStats/eventbridge'
import { createEcsCluster, createMintRunnerTaskDefinition } from './mintRunner/ecs'
import { createEventBridgeTarget } from './mintRunner/eventbridge'
import { createAnalyticsDatabase } from './mintRunner/rds'
import { createMonitorHiddenNFTsEventBridgeTarget } from './monitors/hidden-nfts/eventbridge'
import { createMonitorHiddenNftsLambdaFunction } from './monitors/hidden-nfts/lambda'
import { createSalesProcessorEcsCluster, createSalesProcessorTaskDefinition } from './salesProcessor/ecs'
import { createSalesProcessorEventBridgeTarget } from './salesProcessor/eventbridge'

const pulumiProgram = async (): Promise<Record<string, any> | void> => {
  const stage = getStage()

  // Utilize resources created from gql.shared stack
  const sharedStack = new pulumi.StackReference(`${stage}.shared.us-east-1`)
  const subnets = await sharedStack.getOutputValue('publicSubnetIds')
  const internalEcsSGId = await sharedStack.getOutputValue('internalEcsSGId')
  const vpcId = await sharedStack.getOutputValue('vpcId')

  // START: CRONJOB - MINTRUNNER
  if (isProduction()) {
    createAnalyticsDatabase()  // only create in prod, dont need db per env
  }
  const task = createMintRunnerTaskDefinition()
  const cluster = createEcsCluster()
  createEventBridgeTarget(task, subnets, cluster)
  // END: CRONJOB - MINTRUNNER
  // START: CRONJOB - SALES PROCESSOR
  if (stage !== 'dev') {
    const spTask = createSalesProcessorTaskDefinition()
    const spCluster = createSalesProcessorEcsCluster()
    createSalesProcessorEventBridgeTarget(spTask, subnets, internalEcsSGId, spCluster)
  }
  // END: CRONJOB - SALES PROCESSOR
  // START: CRONJOB - COLLECTION STATS
  if (stage !== 'dev') {
    const csTask = createCollectionStatsTaskDefinition()
    const csCluster = createCollectionStatsEcsCluster()
    createCollectionStatsEventBridgeTarget(csTask, subnets, internalEcsSGId, csCluster)
  }
  // END: CRONJOB - COLLECTION STATS
  // START: CRONJOB - MONITOR/HIDDEN NFTS
  if (isProduction() || 1 === 1) { // force truthiness for dev testing -- TODO: remove before merging
    const lambda = createMonitorHiddenNftsLambdaFunction([internalEcsSGId], subnets, vpcId)
    createMonitorHiddenNFTsEventBridgeTarget(lambda)
  }
  // END: CRONJOB - MONITOR/HIDDEN NFTS
}

export const createCronJobs = (
  preview?: boolean,
): Promise<pulumi.automation.OutputMap> => {
  const stackName = `${process.env.STAGE}.cronjobs.${process.env.AWS_REGION}`
  const workDir = upath.joinSafe(__dirname, 'stack')
  return deployInfra(stackName, workDir, pulumiProgram, preview)
}
