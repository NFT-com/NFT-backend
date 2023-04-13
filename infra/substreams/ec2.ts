import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

import * as process from 'process'


import { SharedInfraOutput } from '../defs'
import { getStage, isProduction } from '../helper'

import { vpcSubnets } from "./index";

export type EC2Output = {
    instance: aws.ec2.Instance,
    template: aws.ec2.LaunchTemplate,
}

const streamingFast_Key = process.env.STREAMINGFAST_KEY;
const git_token = process.env.GH_TOKEN; 
const git_user = process.env.GH_USER; 
const db_pass = process.env.DB_PASSWORD; 

const rawUserData = `#!/bin/bash

echo "Installing Dev Tools"

sudo yum groupinstall 'Development Tools' -y 

##install go 
echo "Installing GO..."

sudo yum install jq go gcc -y 

go install -v google.golang.org/protobuf/cmd/protoc-gen-go@latest

sudo GO111MODULE=on GOBIN=/usr/local/bin go install -v github.com/bufbuild/buf/cmd/buf@v1.15.1

export GOPATH="$HOME/go"
export GOMODCACHE="$HOME/gomodpath"
export GOCACHE="$HOME/gocache"
export PATH="$HOME/go/bin:$PATH"

##install rust
echo "Installing RUST..."

export RUSTUP_HOME=/home/ec2-user/.rustup
export CARGO_HOME=/home/ec2-user/.cargo

curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y

source "/home/ec2-user/.cargo/env"

echo $HOME 

#Install Substreams 
echo "Installing Substreams..."
git clone https://github.com/streamingfast/substreams
cd substreams && go install -v ./cmd/substreams


#Install Substream-sink-postgres 
echo "Installing substream-sink-postgres..."
go install -v github.com/streamingfast/substreams-sink-postgres/cmd/substreams-sink-postgres@latest

#Create ENV Vars 

export STREAMINGFAST_KEY=server_02ac495ea6a467b8688c81b4e37ea538
export SUBSTREAMS_API_TOKEN=$(curl https://auth.streamingfast.io/v1/auth/issue -s --data-binary '{"api_key":"'$STREAMINGFAST_KEY'"}' | jq -r .token)

echo "Getting Substreams code..."

#Download NFT substreams code 

git clone https://${git_user}:${git_token}@github.com/NFT-com/substreams-sync.git

cd substreams-sync

#Initialize PG DBs 
echo "Initializing Substreams Databases..."
substreams-sink-postgres setup "psql://app:${db_pass}@dev-substream-1.clmsk3iud7e0.us-east-1.rds.amazonaws.com/app?sslmode=disable" ./docs/nftLoader/schema.sql

substreams-sink-postgres setup "psql://app:${db_pass}@dev-substream-1.clmsk3iud7e0.us-east-1.rds.amazonaws.com/app?sslmode=disable" ./example_consumer/notifyConsumer.sql

echo "Update DB config files..."
sed -i 's/proto:sf.substreams.database.v1.DatabaseChanges/proto:sf.substreams.sink.database.v1.DatabaseChanges/' docs/nftLoader/substreams.yaml
sed -i 's/12287507/1000000/' docs/nftLoader/substreams.yaml

echo "Build Substreams..." 
cd docs/nftLoader && cargo build --target wasm32-unknown-unknown --release
cd ../..

echo "Run the Substream..."

nohup substreams-sink-postgres run     "psql://app:${db_pass}@dev-substream-1.clmsk3iud7e0.us-east-1.rds.amazonaws.com/app?sslmode=disable"     "ec2-50-17-67-217.compute-1.amazonaws.com:9545"     "./docs/nftLoader/substreams.yaml"     db_out > /tmp/substreams.log 2>&1 &`;

const userData = Buffer.from(rawUserData).toString("base64");

export const createEC2Resources = (
    config: pulumi.Config,
    subnetGroups: vpcSubnets,
    instanceSG: aws.ec2.SecurityGroup
) : EC2Output => {

    const stage = getStage()
    const getInstanceSubnet = (subnetGroups: vpcSubnets) : string => {
        //const index = (Math.random() * (numSubnets - 1)); // pick a random subnet from correct subnet group
        const subnetGroup = isProduction() ? subnetGroups.privateSubnets : subnetGroups.publicSubnets; 
        return subnetGroup[0]; 
    }

    const role = new aws.iam.Role(`substreams-role`, {
        assumeRolePolicy: JSON.stringify({
            Version: "2012-10-17",
            Statement: [{
                Effect: "Allow",
                Principal: {
                    Service: "ec2.amazonaws.com",
                },
                Action: "sts:AssumeRole",
            }],
        }),
    });
/*    
    const instanceProfile = () =>
    {
    return new aws.iam.InstanceProfile("substreams-instance-profile", {
        role: role.name,
    })};
/*
    const SubstreamInstance =  new aws.ec2.Instance("sf-substream-instance", {
        ami: "ami-02f3f602d23f1659d",
        associatePublicIpAddress: true,
        instanceType: config.require('ec2InstanceType'),
        keyName: "ec2-ecs",
        userData: userData,
        maintenanceOptions: {
            autoRecovery: "default",
        },
        metadataOptions: {
            httpEndpoint: "enabled",
            httpPutResponseHopLimit: 2,
            httpTokens: "required",
            instanceMetadataTags: "disabled",
        },
        iamInstanceProfile: {
            name: instanceProfile.name,
        },
        rootBlockDevice: {
            iops: 3000,
            throughput: 125,
            volumeSize: 20,
            volumeType: "gp3",
        },
        subnetId: getInstanceSubnet( subnetGroups ),
        //subnetId: "subnet-05840aae4c820581b",
        tags: {
            Name: `${stage}-sf-substreams`,
        },
        vpcSecurityGroupIds: [instanceSG.id],
    });
*/
    const SubstreamLaunchTemplate = new aws.ec2.LaunchTemplate("sf-substream-launch-template", {
        blockDeviceMappings: [{
            deviceName: "/dev/xvda",
            ebs: {
                deleteOnTermination: "true",
                encrypted: "false",
                iops: 3000,
                throughput: 125,
                volumeSize: 50,
                volumeType: "gp3",
            },
        }],
        capacityReservationSpecification: {
            capacityReservationPreference: "open",
        },
        creditSpecification: {
            cpuCredits: "standard",
        },
        ebsOptimized: "false",
        hibernationOptions: {
            configured: false,
        },
        imageId: "ami-02f3f602d23f1659d",
        instanceInitiatedShutdownBehavior: "stop",
        instanceType: config.require('ec2InstanceType'),
        keyName: "ec2-ecs",
        maintenanceOptions: {
            autoRecovery: "default",
        },
        iamInstanceProfile: {
            arn: "arn:aws:iam::016437323894:instance-profile/substreams-instance-profile-6e600ab",
        },
        metadataOptions: {
            httpEndpoint: "enabled",
            httpProtocolIpv6: "disabled",
            httpPutResponseHopLimit: 2,
            httpTokens: "required",
        },
        name: `${stage}-sf-substreams-template`,
        networkInterfaces: [{
            associatePublicIpAddress: "true",
            deleteOnTermination: "true",
            securityGroups: [instanceSG.id],
            subnetId: getInstanceSubnet( subnetGroups ),
        }],
        placement: {
            tenancy: "default",
        },
        privateDnsNameOptions: {
            enableResourceNameDnsARecord: true,
            hostnameType: "ip-name",
        },
        updateDefaultVersion: true, 
        tagSpecifications: [{
            resourceType: "instance",
            tags: {
                Name: `${stage}-sf-substreams`,
            },
        }],
        userData: userData
});

    const SubstreamInstance =  
        new aws.ec2.Instance("sf-substream-instance", {
            launchTemplate: {
                id: SubstreamLaunchTemplate.id,
                version: SubstreamLaunchTemplate.latestVersion
        }
});

    return { instance : SubstreamInstance, template: SubstreamLaunchTemplate }
    //return SubstreamLaunchTemplate; 
}
