import * as process from 'process'
import * as upath from 'upath'

import * as pulumi from '@pulumi/pulumi'

import { deployInfra, getSharedInfraOutput } from '../helper'
import { createEcsService } from './ecs'

const pulumiProgram = async (): Promise<Record<string, any> | void> => {
  const config = new pulumi.Config()
  const sharedInfraOutput = getSharedInfraOutput()
  createEcsService(config, sharedInfraOutput)
}

export const createGQLServer = (preview?: boolean): Promise<pulumi.automation.OutputMap> => {
  const stackName = `${process.env.STAGE}.gql.${process.env.AWS_REGION}`
  const workDir = upath.joinSafe(__dirname, 'stack')
  return deployInfra(stackName, workDir, pulumiProgram, preview)
}
