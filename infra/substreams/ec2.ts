/* eslint-disable @typescript-eslint/no-unused-vars */
import * as process from 'process'

import * as aws from '@pulumi/aws'
import * as pulumi from '@pulumi/pulumi'

import { getStage } from '../helper'
import { vpcSubnets } from './index'

export type EC2Output = {
    template: aws.ec2.LaunchTemplate
}


export const createUserData = (db_host: string, latestBlock: number) : string => {
    const streamingFast_Key = process.env.STREAMINGFAST_KEY;
    const git_token = process.env.GH_TOKEN; 
    const git_user = process.env.GH_USER; 
    const substreams_db_pass = process.env.SUBSTREAMS_DB_PASSWORD; 
    const eth_endpoint = process.env.ETH_ENDPOINT; 
    const dd_api = process.env.DATADOG_API_KEY; 
    const buffer_size = process.env.UNDO_BUFFER_SIZE;
    const stage = getStage(); 
    const ec2_host = `${stage}-sf-substreams`
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

export STREAMINGFAST_KEY=${streamingFast_Key}
export SUBSTREAMS_API_TOKEN=$(curl https://auth.streamingfast.io/v1/auth/issue -s --data-binary '{"api_key":"'$STREAMINGFAST_KEY'"}' | jq -r .token)

echo "Getting Substreams code..."

#Download NFT substreams code 

git clone https://${git_user}:${git_token}@github.com/NFT-com/nft-backend.git

cd nft-backend/packages/substreams

#Initialize PG DBs 
echo "Initializing Substreams Databases..."
substreams-sink-postgres setup "psql://app:${substreams_db_pass}@${db_host}/app?sslmode=disable" ./docs/nftLoader/schema.sql

substreams-sink-postgres setup "psql://app:${substreams_db_pass}@${db_host}/app?sslmode=disable" ./example_consumer/notifyConsumer.sql

echo "Getting Latest block..." 

export START_BLOCK=$(curl https://api.blockcypher.com/v1/eth/main | jq -r .height)

echo "Update DB config files..."

sed -i 's/proto:sf.substreams.database.v1.DatabaseChanges/proto:sf.substreams.sink.database.v1.DatabaseChanges/' docs/nftLoader/substreams.yaml
sed -i 's/12287507/${latestBlock}/' docs/nftLoader/substreams.yaml

echo "Build Substreams..." 
cd docs/nftLoader && cargo build --target wasm32-unknown-unknown --release
cd ../..

echo "Run the Substream..."

nohup substreams-sink-postgres run  --undo-buffer-size=${buffer_size}     "psql://app:${substreams_db_pass}@${db_host}/app?sslmode=disable"     "${eth_endpoint}"     "./docs/nftLoader/substreams.yaml"     db_out > /tmp/substreams.log 2>&1 &

DD_API_KEY=${dd_api} bash -c "$(curl -L https://raw.githubusercontent.com/DataDog/datadog-agent/master/cmd/agent/install_script.sh)"

sudo chmod 777 /tmp/substreams.log
sudo chown dd-agent:dd-agent /tmp/substreams.log

sudo mkdir /etc/datadog-agent/conf.d/substreams.d

cat > 'conf.yaml' <<-EOF
logs:
  - type: file
    path: /tmp/substreams.log
    service: substreams
    source: substreams
EOF

sudo cp conf.yaml /etc/datadog-agent/conf.d/substreams.d
echo "logs_enabled: true" >> /etc/datadog-agent/datadog.yaml
echo "hostname: ${ec2_host}" >> /etc/datadog-agent/datadog.yaml
sudo service datadog-agent restart`

  return Buffer.from(rawUserData).toString('base64')
}

export const createEC2Resources = (
  config: pulumi.Config,
  subnetGroups: vpcSubnets,
  instanceSG: aws.ec2.SecurityGroup,
  userData: string,
): EC2Output => {
  const stage = getStage()
  const getInstanceSubnet = (subnetGroups: vpcSubnets): string => {
    //const index = (Math.random() * (numSubnets - 1)); // pick a random subnet from correct subnet group
    const subnetGroup = subnetGroups.publicSubnets
    return subnetGroup[0]
  }

  const SubstreamLaunchTemplate = new aws.ec2.LaunchTemplate('sf-substream-launch-template', {
    blockDeviceMappings: [
      {
        deviceName: '/dev/xvda',
        ebs: {
          deleteOnTermination: 'true',
          encrypted: 'false',
          iops: 3000,
          throughput: 125,
          volumeSize: 50,
          volumeType: 'gp3',
        },
      },
    ],
    capacityReservationSpecification: {
      capacityReservationPreference: 'open',
    },
    creditSpecification: {
      cpuCredits: 'standard',
    },
    ebsOptimized: 'false',
    hibernationOptions: {
      configured: false,
    },
    imageId: 'ami-02f3f602d23f1659d',
    instanceInitiatedShutdownBehavior: 'stop',
    instanceType: config.require('ec2InstanceType'),
    keyName: 'ec2-ecs',
    maintenanceOptions: {
      autoRecovery: 'default',
    },
    iamInstanceProfile: {
      arn: 'arn:aws:iam::016437323894:instance-profile/substreams-instance-profile-6e600ab',
    },
    metadataOptions: {
      httpEndpoint: 'enabled',
      httpProtocolIpv6: 'disabled',
      httpPutResponseHopLimit: 2,
      httpTokens: 'required',
    },
    name: `${stage}-sf-substreams-template`,
    networkInterfaces: [
      {
        associatePublicIpAddress: 'true',
        deleteOnTermination: 'true',
        securityGroups: [instanceSG.id],
        subnetId: getInstanceSubnet(subnetGroups),
      },
    ],
    placement: {
      tenancy: 'default',
    },
    privateDnsNameOptions: {
      enableResourceNameDnsARecord: true,
      hostnameType: 'ip-name',
    },
    updateDefaultVersion: true,
    tagSpecifications: [
      {
        resourceType: 'instance',
        tags: {
          Name: `${stage}-sf-substreams`,
          Pulumi: 'true',
        },
      },
    ],
    userData: userData,
  })


    return { template: SubstreamLaunchTemplate }
}
