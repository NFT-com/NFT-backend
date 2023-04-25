import * as upath from 'upath'
import * as pulumi from '@pulumi/pulumi'
import * as aws from '@pulumi/aws'


import { deployInfra } from '../helper'

const pulumiProgram = async() : Promise<Record<string, any> | void> => {

    //define provider resources, these are basically accounts 
    const dev_provider = new aws.Provider("dev-account-provider", {
        assumeRole: {
            roleArn: "arn:aws:iam::135063527524:role/cicd_cross_account",
            sessionName: "pulumi-target-account-session",
    },
        region: "us-east-1",
    });

    const immutable_provider = new aws.Provider("immutable", {
        region: "us-east-1"
    })

    return {
        dev_account: dev_provider ,
        prod_account: immutable_provider
    }

}

export const createAccounts = (preview?: boolean): Promise<pulumi.automation.OutputMap> => {
    const stackName = `${process.env.STAGE}.immutable.accounts.${process.env.AWS_REGION}`
    const workDir = upath.joinSafe(__dirname, 'stack')
    return deployInfra(stackName, workDir, pulumiProgram, preview)
}