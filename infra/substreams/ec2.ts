import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

import { SharedInfraOutput } from '../defs'
import { getStage, isProduction } from '../helper'

import { vpcSubnets } from "./index";

const getInstanceSubnet = (subnetGroups: vpcSubnets, numSubnets: number) : string => {
    const index = (Math.random() * (numSubnets - 1)); // pick a random subnet from correct subnet group
    const subnetGroup = isProduction() ? subnetGroups.privateSubnets : subnetGroups.publicSubnets; 
    return subnetGroup[index]; 
}

const getUserData = (): string => {
    return ``
}


export const createSubstreamInstance = (
    config: pulumi.Config,
    subnetGroups: vpcSubnets,
    instanceSG: aws.ec2.SecurityGroup, 
    ): aws.ec2.Instance => {
    const stage = getStage();
    return new aws.ec2.Instance("sf-substream-instance", {
        ami: "ami-02f3f602d23f1659d",
        associatePublicIpAddress: true,
        instanceType: config.require('ec2InstanceType'),
        keyName: "ec2-ecs",
        maintenanceOptions: {
            autoRecovery: "default",
        },
        metadataOptions: {
            httpEndpoint: "enabled",
            httpPutResponseHopLimit: 2,
            httpTokens: "required",
            instanceMetadataTags: "disabled",
        },
        privateDnsNameOptions: {
            enableResourceNameDnsARecord: true,
            hostnameType: "ip-name",
        },
        rootBlockDevice: {
            iops: 3000,
            throughput: 125,
            volumeSize: 20,
            volumeType: "gp3",
        },
        subnetId: getInstanceSubnet( subnetGroups ,Number(config.require('numSubnets'))),
        tags: {
            Name: `${stage}-sf-substreams`,
        },
        vpcSecurityGroupIds: [instanceSG.id],
    });

}