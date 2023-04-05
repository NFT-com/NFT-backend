import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

import { SharedInfraOutput } from '../defs'
import { getStage } from '../helper'


export const createSubstreamInstance = (infraOutput: SharedInfraOutput): aws.ec2.Instance => {
    const stage = getStage();
    return new aws.ec2.Instance("sf-substream-instance", {
        ami: "ami-02f3f602d23f1659d",
        associatePublicIpAddress: true,
        availabilityZone: "us-east-1a",
        instanceType: "t2.small",
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
        subnetId: "subnet-040ff4d602e11aaaa",
        tags: {
            Name: `${stage}-sf-substreams`,
        },
        vpcSecurityGroupIds: [
            "sg-0dfc49b1edc875837",
            "sg-0a8c0d54dc2e010f7",
        ],
    });

}