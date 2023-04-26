import * as upath from 'upath'

import * as pulumi from '@pulumi/pulumi'

import { deployInfra } from '../helper'
import { createAuroraClusters } from './aurora'
import { createRepositories } from './ecr'
import { createCacheClusters } from './elasticache'
//import { createBuckets } from './s3'
import { createSecurityGroups } from './security-group'
import { createVPC } from './vpc'
import { create_dev_provider, create_prod_provider } from '../cross-account-shared'
const pulumiProgram = async (): Promise<Record<string, any> | void> => {
  const config = new pulumi.Config()
  const zones = config.require('availabilityZones').split(',')
  const dev_provider = create_dev_provider()

  const vpc = createVPC(dev_provider)
  const sgs = await createSecurityGroups(config, vpc, dev_provider)
  const { main: dbMain } = createAuroraClusters(config, vpc, sgs.aurora, zones, dev_provider)
  const { main: cacheMain } = createCacheClusters(config, vpc, sgs.redis, zones, dev_provider)
  //const { asset, assetRole } = createBuckets(dev_provider)
  const { gql } = createRepositories(dev_provider)

  return {
    //assetBucket: asset.bucket,
    //assetBucketRole: assetRole.arn,
    dbHost: dbMain.endpoint,
    gqlECRRepo: gql.name,
    internalEcsSGId: sgs.internalEcs.id,
    redisHost: cacheMain.cacheNodes[0].address,
    publicSubnetIds: vpc.publicSubnetIds,
    privateSubnetIds: vpc.privateSubnetIds,
    vpcId: vpc.id,
    typesenseSGId: sgs.typesense.id,
    webSGId: sgs.web.id,
    webEcsSGId: sgs.webEcs.id,
  }
}

export const createSharedInfra = (preview?: boolean): Promise<pulumi.automation.OutputMap> => {
  const stackName = `${process.env.STAGE}.${process.env.ACCOUNT}.shared.${process.env.AWS_REGION}`
  const workDir = upath.joinSafe(__dirname, 'stack')
  return deployInfra(stackName, workDir, pulumiProgram, preview)
}