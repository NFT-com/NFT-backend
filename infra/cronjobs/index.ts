import * as process from 'process'
import * as upath from 'upath'

import * as pulumi from '@pulumi/pulumi'

import { deployInfra, getStage, isProduction, pulumiOutToValue } from '../helper'
import { createEcsCluster,createMintRunnerTaskDefinition } from './mintRunner/ecs'
import { createEventBridgeTarget } from './mintRunner/eventbridge'
import { createAnalyticsDatabase } from './mintRunner/rds'
import { createSalesProcessorTaskDefinition, createSalesProessorEcsCluster } from './salesProcessor/ecs'
import { createSalesProessorEventBridgeTarget } from './salesProcessor/eventbridge'

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
  if (isProduction()) {
    const spTask = createSalesProcessorTaskDefinition()
    const spCluster = createSalesProessorEcsCluster()
    createSalesProessorEventBridgeTarget(spTask,subnetVal,spCluster)
  }
  // END: CRONJOB - SALES PROCESSOR
}

export const createCronJobs = (
  preview?: boolean,
): Promise<pulumi.automation.OutputMap> => {
  const stackName = `${process.env.STAGE}.cronjobs.${process.env.AWS_REGION}`
  const workDir = upath.joinSafe(__dirname, 'stack')
  return deployInfra(stackName, workDir, pulumiProgram, preview)
}
