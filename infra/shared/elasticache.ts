import * as aws from '@pulumi/aws'
import { ec2 } from '@pulumi/awsx'
import * as pulumi from '@pulumi/pulumi'

import { getResourceName, isProduction } from '../helper'

export type CacheOutput = {
  main: aws.elasticache.Cluster
}

const getSubnetGroup = (vpc: ec2.Vpc, provider : aws.Provider): aws.elasticache.SubnetGroup => {
  return new aws.elasticache.SubnetGroup('cache_subnet_group', {
    name: getResourceName('cache'),
    subnetIds: isProduction() ? vpc.privateSubnetIds : vpc.publicSubnetIds,
  }, { provider: provider }  )
}

const createMain = (
  config: pulumi.Config,
  vpc: ec2.Vpc,
  sg: aws.ec2.SecurityGroup,
  zones: string[],
  provider : aws.Provider
): aws.elasticache.Cluster => {
  const parameterGroup = new aws.elasticache.ParameterGroup('redis_main_param_group', {
    name: getResourceName('main'),
    family: 'redis6.x',
    parameters: [
      {
        name: 'set-max-intset-entries',
        value: '1000',
      },
      {
        name: 'hash-max-ziplist-entries',
        value: '1000',
      },
      {
        name: 'maxmemory-policy',
        value: 'allkeys-lfu',
      },
    ],
  }, { provider: provider }
  )

  const instance = config.require('redisMainInstance')
  const subnetGroup = getSubnetGroup(vpc)
  return new aws.elasticache.Cluster('redis_main', {
    clusterId: getResourceName('main'),
    engine: 'redis',
    engineVersion: '6.x',
    nodeType: instance,
    parameterGroupName: parameterGroup.name,
    availabilityZone: zones[0],
    securityGroupIds: [sg.id],
    subnetGroupName: subnetGroup.name,
    numCacheNodes: 1,
    port: 6379,
  }, { provider: provider }
  )
}

export const createCacheClusters = (
  config: pulumi.Config,
  vpc: ec2.Vpc,
  sg: aws.ec2.SecurityGroup,
  zones: string[],
  provider : aws.Provider
): CacheOutput => {
  const main = createMain(config, vpc, sg, zones, provider)
  return { main }
}
