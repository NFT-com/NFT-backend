import * as process from 'process'
import * as upath from 'upath'

import * as pulumi from '@pulumi/pulumi'

import { deployInfra, getStage, isProduction, pulumiOutToValue } from '../helper'
import { createCollectionStatsEcsCluster,createCollectionStatsTaskDefinition } from './collectionStats/ecs'
import { createCollectionStatsEventBridgeTarget } from './collectionStats/eventbridge'
import { createDBSyncEcsCluster,createDBSyncTaskDefinition } from './dbsync/ecs'
import { createDBSyncEventBridgeTarget } from './dbsync/eventbridge'
import { createEcsCluster,createMintRunnerTaskDefinition } from './mintRunner/ecs'
import { createEventBridgeTarget } from './mintRunner/eventbridge'
import { createAnalyticsDatabase } from './mintRunner/rds'
import { createSalesProcessorEcsCluster,createSalesProcessorTaskDefinition } from './salesProcessor/ecs'
import { createSalesProcessorEventBridgeTarget } from './salesProcessor/eventbridge'

const pulumiProgram = async (): Promise<Record<string, any> | void> => {
  //const config = new pulumi.Config()
  const stage = getStage()

  // Utilize resources created from gql.shared stack
  const sharedStack = new pulumi.StackReference(`${stage}.shared.us-east-1`)
  //const vpc = sharedStack.getOutput('vpcId') 
  const subnets =  sharedStack.getOutput('publicSubnetIds')

  // VPC and Public Subnets to be used for all Cronjobs 
  //const vpcVal: string = await pulumiOutToValue(vpc) 
  const subnetVal: string[] = await pulumiOutToValue(subnets)

  // START: CRONJOB - MINTRUNNER
  if (isProduction()) {
    createAnalyticsDatabase()  // only create in prod, dont need db per env
  }
  const task = createMintRunnerTaskDefinition()
  const cluster = createEcsCluster()
  createEventBridgeTarget(task,subnetVal,cluster)
  // END: CRONJOB - MINTRUNNER
  
  // START: CRONJOB - SALES PROCESSOR
  if (stage !== 'dev') {
    const spTask = createSalesProcessorTaskDefinition()
    const spCluster = createSalesProcessorEcsCluster()
    createSalesProcessorEventBridgeTarget(spTask,subnetVal,spCluster)
  }
  // END: CRONJOB - SALES PROCESSOR
  
  // START: CRONJOB - COLLECTION STATS
  if (stage !== 'dev') {
    const csTask = createCollectionStatsTaskDefinition()
    const csCluster = createCollectionStatsEcsCluster()
    createCollectionStatsEventBridgeTarget(csTask,subnetVal,csCluster)
  }
  // END: CRONJOB - COLLECTION STATS 
  
  // START: CRONJOB - DB SYNC (CREATE IN PROD ONLY)
  if (stage === 'prod') {
    const dbSyncTask = createDBSyncTaskDefinition()
    const dbSyncCluster = createDBSyncEcsCluster()
    createDBSyncEventBridgeTarget(dbSyncTask,subnetVal,dbSyncCluster)
  }
  // END: CRONJOB - DB SYNC
}

export const createCronJobs = (
  preview?: boolean,
): Promise<pulumi.automation.OutputMap> => {
  const stackName = `${process.env.STAGE}.cronjobs.${process.env.AWS_REGION}`
  const workDir = upath.joinSafe(__dirname, 'stack')
  return deployInfra(stackName, workDir, pulumiProgram, preview)
}
