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
  const { asset, assetRole } = createBuckets()
  const { gql, stream } = createRepositories()

  return {
    assetBucket: asset.bucket,
    assetBucketRole: assetRole.arn,
    dbHost: dbMain.endpoint,
    gqlECRRepo: gql.name,
    streamECRRepo: stream.name,
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
  const stackName = `${process.env.STAGE}.shared.${process.env.AWS_REGION}`
  const workDir = upath.joinSafe(__dirname, 'stack')
  return deployInfra(stackName, workDir, pulumiProgram, preview)
}
