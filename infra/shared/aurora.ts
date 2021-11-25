import * as aws from '@pulumi/aws'
import { EngineType } from '@pulumi/aws/types/enums/rds'
import { ec2 } from '@pulumi/awsx'
import * as pulumi from '@pulumi/pulumi'

import { getResourceName, isFalse, isProduction } from '../helper'

export type AuroraOutput = {
  main: aws.rds.Cluster
}

const getSubnetGroup = (vpc: ec2.Vpc): aws.rds.SubnetGroup => {
  return new aws.rds.SubnetGroup('aurora_subnet_group', {
    name: getResourceName('aurora'),
    subnetIds: isProduction() ? vpc.privateSubnetIds : vpc.publicSubnetIds,
  })
}

// https://github.com/pulumi/pulumi-aws-quickstart-aurora-postgres/blob/master/provider/pkg/provider/postgresql.go
const createMain = (
  config: pulumi.Config,
  vpc: ec2.Vpc,
  sg: aws.ec2.SecurityGroup,
  zones: string[],
): aws.rds.Cluster => {
  const paramFamily = 'aurora-postgresql13'
  const clusterParameterGroup = new aws.rds.ClusterParameterGroup('aurora_main_cluster_param_group', {
    name: getResourceName('main-cluster'),
    family: paramFamily,
    parameters: [
      {
        name: 'rds.force_ssl',
        value: '1',
        applyMethod: 'pending-reboot',
      },
    ],
  })

  const subnetGroup = getSubnetGroup(vpc)
  const engineType = EngineType.AuroraPostgresql
  const cluster = new aws.rds.Cluster('aurora_main_cluster', {
    engine: engineType,
    engineVersion: '13.3',
    availabilityZones: zones,
    vpcSecurityGroupIds: [sg.id],
    dbSubnetGroupName: subnetGroup.name,
    storageEncrypted: true,
    clusterIdentifier: getResourceName('main'),
    dbClusterParameterGroupName: clusterParameterGroup.name,

    masterUsername: 'app',
    masterPassword: process.env.DB_PASSWORD,
    databaseName: 'app',

    skipFinalSnapshot: true,
    backupRetentionPeriod: isProduction() ? 7 : 1,
    preferredBackupWindow: '07:00-09:00',
  })

  const dbParameterGroup = new aws.rds.ParameterGroup('aurora_main_instance_param_group', {
    name: getResourceName('main-instance'),
    family: paramFamily,
    parameters: [
      {
        name: 'log_rotation_age',
        value: '1440',
      },
      {
        name: 'log_rotation_size',
        value: '102400',
      },
    ],
  })
  const instance = config.require('auroraMainInstance')
  const numInstances = parseInt(config.require('auroraMainInstances')) || 1
  const clusterInstances: aws.rds.ClusterInstance[] = []
  for (let i = 0; i < numInstances; i++) {
    clusterInstances.push(new aws.rds.ClusterInstance(`aurora_main_instance_${i + 1}`, {
      identifier: getResourceName(`main-${i+1}`),
      clusterIdentifier: cluster.id,
      instanceClass: instance,
      engine: engineType,
      engineVersion: cluster.engineVersion,
      dbParameterGroupName: dbParameterGroup.name,
      dbSubnetGroupName: subnetGroup.name,
      availabilityZone: zones[0],
      autoMinorVersionUpgrade: true,
      publiclyAccessible: isFalse(isProduction()),
    }))
  }

  return cluster
}

export const createAuroraClusters = (
  config: pulumi.Config,
  vpc: ec2.Vpc,
  sg: aws.ec2.SecurityGroup,
  zones: string[],
): AuroraOutput => {
  const main = createMain(config, vpc, sg, zones)
  return { main }
}
