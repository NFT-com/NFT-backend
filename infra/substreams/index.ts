import * as pulumi from '@pulumi/pulumi';

import * as process from 'process'
import * as upath from 'upath'

import { deployInfra, getStage, pulumiOutToValue } from '../helper';
import { createSubstreamInstance } from './ec2';
import { createSubstreamClusters } from './rds';
import {  buildSecurityGroups } from './securityGroups'

export type vpcSubnets = {
  publicSubnets: string[],
  privateSubnets: string[]
}

const pulumiProgram = async (): Promise<Record<string, any> | void> => {
    const config = new pulumi.Config();
    const stage = getStage();

    const sharedStack = new pulumi.StackReference(`${stage}.shared.us-east-1`)

    const vpc = (await pulumiOutToValue(sharedStack.getOutput('vpcId'))) as string 
    const publicSubnets = (await pulumiOutToValue(sharedStack.getOutput('publicSubnetIds'))) as string[]
    const privateSubnets = (await pulumiOutToValue(sharedStack.getOutput('privateSubnetIds'))) as string[]

    const subnets : vpcSubnets = { publicSubnets, privateSubnets}; 

    const zones = config.require('availabilityZones').split(',');
    const numSubnets = config.require('numSubnets'); 

    //const vpc = sharedInfraOutput.vpcId; 
    //const subStreamEC2SG = sharedInfraOutput.subStreamEc2SGId; 
    //const subStreamrdsSG = sharedInfraOutput.subStreamRDSSGId; 
    const securityGroups = buildSecurityGroups(config, vpc)
    createSubstreamInstance();   
    createSubstreamClusters(config, subnets, securityGroups.rdsSG, zones); 
    
  }
  
export const createSubStreams = (preview?: boolean): Promise<pulumi.automation.OutputMap> => {
    const stackName = `${process.env.STAGE}.substreams.${process.env.AWS_REGION}`
    const workDir = upath.joinSafe(__dirname, 'stack')
    return deployInfra(stackName, workDir, pulumiProgram, preview)
}