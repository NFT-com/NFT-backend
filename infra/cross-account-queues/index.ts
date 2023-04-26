/* eslint-disable @typescript-eslint/no-unused-vars */

import * as upath from 'upath'
import * as pulumi from '@pulumi/pulumi'

import { deployInfra, getStage, pulumiOutToValue } from '../helper'
import { createQueue } from './sqs'
import { create_dev_provider } from '../cross-account-shared'

const pulumiProgram = async() : Promise<Record<string, any> | void> => {
    //use method from shared accounts 
    const dev_provider = create_dev_provider(); 

    const queue = createQueue(dev_provider)

    return {
        queueName: queue.name
    }
}
//commenting for deploy
export const createQueues = (preview?: boolean): Promise<pulumi.automation.OutputMap> => {
    const stackName = `${process.env.STAGE}.${process.env.ACCOUNT}.queues.${process.env.AWS_REGION}`
    const workDir = upath.joinSafe(__dirname, 'stack')
    return deployInfra(stackName, workDir, pulumiProgram, preview)
}
