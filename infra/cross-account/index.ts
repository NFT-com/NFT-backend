/* eslint-disable @typescript-eslint/no-unused-vars */

import * as upath from 'upath'
import * as pulumi from '@pulumi/pulumi'
import * as aws from '@pulumi/aws'


import { deployInfra, isProduction } from '../helper'
import { createQueue } from './sqs'

const pulumiProgram = async() : Promise<Record<string, any> | void> => {

    //define provider resources, these are basically accounts 
    const dev_provider = new aws.Provider("target-account-provider", {
        assumeRole: {
            roleArn: "arn:aws:iam::135063527524:role/cicd_cross_account",
            sessionName: "pulumi-target-account-session",
        },
        region: "us-east-1",
    });
    //const prod_provider = pulumi.ProviderResource.get("aws", "")

/*
    const stack_provider = (config: pulumi.Config) : pulumi.Provider => {
        let account = config.require("account"); 
        if (account === "prod") {
            return prod_provider; 
        }
        else if (account === "dev"){
            return dev_provider; 
        }
    }
*/

    //const stack_provider : pulumi.Provider = isProduction() ? prod_provider : dev_provider
    const queue = createQueue(dev_provider)

    return {
        queueName: queue.name
    }
}

export const createQueues = (preview?: boolean): Promise<pulumi.automation.OutputMap> => {
    const stackName = `${process.env.STAGE}.crossacc.${process.env.AWS_REGION}`
    const workDir = upath.joinSafe(__dirname, 'stack')
    return deployInfra(stackName, workDir, pulumiProgram, preview)
}
  