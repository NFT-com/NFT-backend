import * as upath from 'upath'

import * as pulumi from '@pulumi/pulumi'

import { deployInfra } from '../helper'
import { createAuroraClusters } from './aurora'
import { createRepositories } from './ecr'
import { createCacheClusters } from './elasticache'
import { createBuckets } from './s3'
import { createSecurityGroups } from './security-group'
import { createVPC } from './vpc'

const pulumiProgram = async (): Promise<Record<string, any> | void> => {
  const config = new pulumi.Config()
  const zones = config.require('availabilityZones').split(',')

  const vpc = createVPC()
  const sgs = await createSecurityGroups(config, vpc)
  const { main: dbMain } = createAuroraClusters(config, vpc, sgs.aurora, zones)
  const { main: cacheMain } = createCacheClusters(config, vpc, sgs.redis, zones)
  const { asset, assetRole, deployApp } = createBuckets()
  const { gql } = createRepositories()

  return {
    assetBucket: asset.bucket,
    assetBucketRole: assetRole.arn,
    dbHost: dbMain.endpoint,
    deployAppBucket: deployApp.bucket,
    gqlECRRepo: gql.name,
    redisHost: cacheMain.cacheNodes[0].address,
    publicSubnetIds: vpc.publicSubnetIds,
    vpcId: vpc.id,
    webSGId: sgs.web.id,
  }
}

export const createSharedInfra = (
  preview?: boolean,
): Promise<pulumi.automation.OutputMap> => {
  const stackName = `${process.env.STAGE}.shared.${process.env.AWS_REGION}`
  const workDir = upath.joinSafe(__dirname, 'stack')
  return deployInfra(stackName, workDir, pulumiProgram, preview)
}
