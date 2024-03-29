import * as aws from '@pulumi/aws'
import { EngineType } from '@pulumi/aws/types/enums/rds'
import * as pulumi from '@pulumi/pulumi'


import { getResourceName, isProduction } from "../helper";
import { vpcSubnets } from "./index";

export type SubstreamRDSOutput = {
    main: aws.rds.Cluster
}

//should take in an array of subnets
const getSubnetGroup = (subnetGroups: vpcSubnets): aws.rds.SubnetGroup => {
  return new aws.rds.SubnetGroup('aurora_subnet_group', {
    name: getResourceName('substreams_v2'),
    subnetIds: subnetGroups.publicSubnets,
  })
}

const createMain = (
  config: pulumi.Config,
  subnetGroups: vpcSubnets,
  securityGroup: aws.ec2.SecurityGroup,
  zones: string[],
): aws.rds.Cluster => {
  const subnetGroup = getSubnetGroup(subnetGroups)
  const engineType = EngineType.AuroraPostgresql
  const sf_cluster = new aws.rds.Cluster('sf-cluster', {
    engine: engineType,
    engineVersion: '14.6',
    availabilityZones: zones,
    vpcSecurityGroupIds: [securityGroup.id],
    dbSubnetGroupName: subnetGroup.name,
    dbClusterParameterGroupName: 'default.aurora-postgresql14',
    storageEncrypted: true,
    clusterIdentifier: getResourceName('substreams-v2'),

    skipFinalSnapshot: true,
    backupRetentionPeriod: isProduction() ? 7 : 1,
    preferredBackupWindow: '07:00-09:00',

    databaseName: 'app',
    masterUsername: 'app',
    masterPassword: process.env.SUBSTREAMS_DB_PASSWORD,
    port: 5432,
  })

  const numInstances = 1
  const clusterInstances: aws.rds.ClusterInstance[] = []
  for (let i = 0; i < numInstances; i++) {
    clusterInstances.push(
        new aws.rds.ClusterInstance(`substreams_main_instance_${i + 1}`, 
        {
            identifier: getResourceName(`substream-v2-${ i + 1}`),
            clusterIdentifier: sf_cluster.id,
            instanceClass: config.require('RDSInstanceType'),
            engine: engineType,
            engineVersion: sf_cluster.engineVersion,
            dbParameterGroupName: "default.aurora-postgresql14",
            dbSubnetGroupName: subnetGroup.name,
            availabilityZone: zones[0],

            performanceInsightsEnabled: true,

        autoMinorVersionUpgrade: true,
        publiclyAccessible: true,
      }),
    )
  }

  return sf_cluster
}

export const createSubstreamClusters = (

    config: pulumi.Config,
    subnetGroups: vpcSubnets,
    securityGroup: aws.ec2.SecurityGroup,
    zones: string[],
  ): SubstreamRDSOutput => {
    const main = createMain(config, subnetGroups, securityGroup, zones)
    return { main: main}
  }
  

