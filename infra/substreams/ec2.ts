import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

import * as process from 'process'


import { SharedInfraOutput } from '../defs'
import { getStage, isProduction } from '../helper'

import { vpcSubnets } from "./index";

const getInstanceSubnet = (subnetGroups: vpcSubnets, numSubnets: number) : string => {
    const index = (Math.random() * (numSubnets - 1)); // pick a random subnet from correct subnet group
    const subnetGroup = isProduction() ? subnetGroups.privateSubnets : subnetGroups.publicSubnets; 
    return subnetGroup[index]; 
}

const streamingFast_Key = process.env.STREAMINGFAST_KEY;
const git_token = process.env.GH_TOKEN; 
const git_user = process.env.GH_USER; 
const db_pass = process.env.DB_PASSWORD; 

const getUserData = (): string => {
    return `
    #!/bin/bash

        sudo yum groupinstall 'Development Tools' -y 

        ##install go 

        sudo yum install jq go gcc -y 

        go install -v google.golang.org/protobuf/cmd/protoc-gen-go@latest

        sudo GO111MODULE=on GOBIN=/usr/local/bin go install -v github.com/bufbuild/buf/cmd/buf@v1.15.1

        export PATH="$HOME/go/bin:$PATH"

        ##install rust
        export RUSTUP_HOME=/home/ec2-user/.rustup
        export CARGO_HOME=/home/ec2-user/.cargo

        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y

        source "/home/ec2-user/.cargo/env"

        #install substreams 

        #which brew 

        #brew install streamingfast/tap/substreams

        substreams -v 

        #Create ENV Vars 

        export STREAMINGFAST_KEY=${streamingFast_Key}

        export SUBSTREAMS_API_TOKEN=$(curl https://auth.streamingfast.io/v1/auth/issue -s --data-binary '{"api_key":"'$STREAMINGFAST_KEY'"}' | jq -r .token)

        #Download NFT substreams code 

        git clone https://${git_user}:${git_token}@github.com/NFT-com/substreams-sync.git

        cd substreams-sync

        #Initialize PG DBs 

        substreams-sink-postgres setup "psql://app:${db_pass}@dev-substream-1.clmsk3iud7e0.us-east-1.rds.amazonaws.com/app?sslmode=disable" ./docs/nftLoader/schema.sql

        substreams-sink-postgres setup "psql://app:${db_pass}@dev-substream-1.clmsk3iud7e0.us-east-1.rds.amazonaws.com/app?sslmode=disable" ./example_consumer/notifyConsumer.sql

        #Change string in substreams.yaml
        sed -i 's/proto:sf.substreams.database.v1.DatabaseChanges/proto:sf.substreams.sink.database.v1.DatabaseChanges/' docs/nftLoader/substreams.yaml

        cd docs/nftLoader && cargo build --target wasm32-unknown-unknown --release
        cd ../..


        #Run the substreams 
        nohup substreams-sink-postgres run     "psql://dev-node:insecure-change-me-in-prod@localhost:5432/dev-node?sslmode=disable"     "mainnet.eth.streamingfast.io:443"     "./docs/nftLoader/substreams.yaml"     db_out > /tmp/substreams.log 2>&1 &
    `
}

//
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
        userData: getUserData(),
        maintenanceOptions: {
            autoRecovery: "default",
        },
        metadataOptions: {
            httpEndpoint: "enabled",
            httpPutResponseHopLimit: 2,
            httpTokens: "required",
            instanceMetadataTags: "disabled",
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