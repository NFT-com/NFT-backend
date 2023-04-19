import * as upath from 'upath'
import * as pulumi from '@pulumi/pulumi'

import { deployInfra } from '../helper'
import { createQueue } from './sqs'

const pulumiProgram = async() : Promise<Record<string, any> | void> => {

    const queue = createQueue()

    return {
        queueName: queue.name
    }
}

export const createQueues = (preview?: boolean): Promise<pulumi.automation.OutputMap> => {
    const stackName = `${process.env.STAGE}.shared.${process.env.AWS_REGION}`
    const workDir = upath.joinSafe(__dirname, 'stack')
    return deployInfra(stackName, workDir, pulumiProgram, preview)
  }
  