/* eslint-disable @typescript-eslint/no-unused-vars */

import * as upath from 'upath'
import * as pulumi from '@pulumi/pulumi'
import * as aws from '@pulumi/aws'


import { deployInfra, getStage, pulumiOutToValue } from '../helper'
import { createQueue } from './sqs'

const pulumiProgram = async() : Promise<Record<string, any> | void> => {
    const stage = getStage(); 
    const accountsStack = new pulumi.StackReference(`${stage}.immutable.accounts.us-east-1`)
    const dev_provider = (await pulumiOutToValue(accountsStack.getOutput('dev_account'))) as aws.Provider 
    const queue = createQueue(dev_provider)

    return {
        queueName: queue.name
    }
}

export const createQueues = (preview?: boolean): Promise<pulumi.automation.OutputMap> => {
    const stackName = `${process.env.STAGE}.${process.env.ACCOUNT}.queues.${process.env.AWS_REGION}`
    const workDir = upath.joinSafe(__dirname, 'stack')
    return deployInfra(stackName, workDir, pulumiProgram, preview)
}
