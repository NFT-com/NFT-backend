import * as pulumi from '@pulumi/pulumi';
import * as aws from "@pulumi/aws";

import * as process from 'process'
import * as upath from 'upath'

import { deployInfra, getStage, pulumiOutToValue } from '../helper';
import { createEC2Resources, createUserData } from './ec2';
import { createSubstreamClusters } from './rds';
import {  buildSecurityGroups } from './securityGroups'

export type vpcSubnets = {
  publicSubnets: string[],
  privateSubnets: string[]
}



const rdsStack = async (): Promise<Record<string, any> | void> => {
    const config = new pulumi.Config();
    const stage = getStage();

    const sharedStack = new pulumi.StackReference(`${stage}.shared.us-east-1`)


    const vpc = (await pulumiOutToValue(sharedStack.getOutput('vpcId'))) as string 
    const publicSubnets = (await pulumiOutToValue(sharedStack.getOutput('publicSubnetIds'))) as string[]
    const privateSubnets = (await pulumiOutToValue(sharedStack.getOutput('privateSubnetIds'))) as string[]

    const subnets : vpcSubnets = { publicSubnets : publicSubnets, privateSubnets : privateSubnets}; 

    const zones = config.require('availabilityZones').split(',');

    const securityGroups = buildSecurityGroups(config, vpc)

    //createSubstreamInstance(config, subnets, securityGroups.ec2SG);
    //createSubstreamLaunchTemplate(config, subnets, securityGroups.ec2SG);
    const { main : cluster, host: dbhost} = createSubstreamClusters(config, subnets, securityGroups.rdsSG, zones); 

    return {
      dbHost: cluster.endpoint,
      ec2SecurityGroup: securityGroups.ec2SG, 
      sharedStack: pulumi.StackReference


    }
    
  }

const ec2_stack = async (): Promise<Record<string, any> | void> => {

  const config = new pulumi.Config();
  const stage = getStage();

  const sharedStack = new pulumi.StackReference(`${stage}.shared.us-east-1`)
  const rdsStack = new pulumi.StackReference(`${stage}.substreams_rds.us-east-1`)
  //const sharedStack = (await pulumiOutToValue(rdsStack.getOutput('sharedStack'))) as pulumi.StackReference
  const vpc = (await pulumiOutToValue(sharedStack.getOutput('vpcId'))) as string 
  const publicSubnets = (await pulumiOutToValue(sharedStack.getOutput('publicSubnetIds'))) as string[]
  const privateSubnets = (await pulumiOutToValue(sharedStack.getOutput('privateSubnetIds'))) as string[]

  const subnets : vpcSubnets = { publicSubnets : publicSubnets, privateSubnets : privateSubnets}; 

  const zones = config.require('availabilityZones').split(',');

  const dbHost = (await pulumiOutToValue(rdsStack.getOutput('dbHost'))) as string 
  const ec2SG = (await pulumiOutToValue(rdsStack.getOutput('ec2SecurityGroup'))) as aws.ec2.SecurityGroup

  const userData = createUserData(dbHost); 

  createEC2Resources(config, subnets, ec2SG, userData );


}

export const createSubStreams = (preview?: boolean): Promise<pulumi.automation.OutputMap> => {
    const stackName = `${process.env.STAGE}.substreams_rds.${process.env.AWS_REGION}`
    const workDir = upath.joinSafe(__dirname, 'stack')
    return deployInfra(stackName, workDir, rdsStack, preview)
}


export const createSubStreamInstances = (preview?: boolean): Promise<pulumi.automation.OutputMap> => {
  const stackName = `${process.env.STAGE}.substreams_ec2.${process.env.AWS_REGION}`
  const workDir = upath.joinSafe(__dirname, 'stack')
  return deployInfra(stackName, workDir, ec2_stack, preview)
}
