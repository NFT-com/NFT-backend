/* eslint-disable @typescript-eslint/no-unused-vars */

import * as upath from 'upath'
import * as pulumi from '@pulumi/pulumi'
import * as aws from '@pulumi/aws'


import { deployInfra } from '../helper'
import { createQueue } from './sqs'

const pulumiProgram = async() : Promise<Record<string, any> | void> => {

    const queue = createQueue()

    const dev_provider = new aws.Provider("target-account-provider", {
        assumeRole: {
            roleArn: "arn:aws:iam::135063527524:role/cicd_cross_account",
            sessionName: "pulumi-target-account-session",
        },
        region: "us-east-1",
    });
    

    return {
        queueName: queue.name
    }
}



export const createQueues = (preview?: boolean): Promise<pulumi.automation.OutputMap> => {
    const stackName = `${process.env.STAGE}.crossacc.${process.env.AWS_REGION}`
    const workDir = upath.joinSafe(__dirname, 'stack')
    return deployInfra(stackName, workDir, pulumiProgram, preview)
  }
  