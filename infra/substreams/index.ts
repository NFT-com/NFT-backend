import * as pulumi from '@pulumi/pulumi';

import * as process from 'process'
import * as upath from 'upath'

import { deployInfra, getSharedInfraOutput } from '../helper';
import { createSubstreamInstance } from './ec2';
import { createSubstreamClusters } from './rds';


const pulumiProgram = async (): Promise<Record<string, any> | void> => {
    const config = new pulumi.Config();
    const sharedInfraOutput = getSharedInfraOutput();
    
    const zones = config.require('availabilityZones').split(',');
    const vpc = sharedInfraOutput.vpcId; 
    const subStreamEC2SG = sharedInfraOutput.subStreamEc2SGId; 
    const subStreamrdsSG = sharedInfraOutput.subStreamRDSSGId; 

    createSubstreamInstance(sharedInfraOutput);   
    createSubstreamClusters(config, sharedInfraOutput, zones); 
    
  }
  
export const createSubStreams = (preview?: boolean): Promise<pulumi.automation.OutputMap> => {
    const stackName = `${process.env.STAGE}.substreams.${process.env.AWS_REGION}`
    const workDir = upath.joinSafe(__dirname, 'stack')
    return deployInfra(stackName, workDir, pulumiProgram, preview)
}
  