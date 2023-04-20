import * as console from 'console'
import fs from 'fs'
import * as process from 'process'
import * as upath from 'upath'

import * as pulumi from '@pulumi/pulumi'

import { createCronJobs } from './cronjobs'
import { SharedInfraOutput, sharedOutputFileName } from './defs'
import { createGQLServer } from './gql'
import { createSharedInfra } from './shared'
import { createStreamCluster } from './stream'
import { createSubStreamInstances, createSubStreams } from './substreams'
import { createTypesenseCluster } from './typesense'

export const sharedOutToJSONFile = (outMap: pulumi.automation.OutputMap): void => {
  const assetBucket = outMap.assetBucket.value
  const assetBucketRole = outMap.assetBucketRole.value
  const dbHost = outMap.dbHost.value
  const gqlECRRepo = outMap.gqlECRRepo.value
  const redisHost = outMap.redisHost.value
  const publicSubnets = outMap.publicSubnetIds.value
  const privateSubnets = outMap.privateSubnetIds.value
  const vpcId = outMap.vpcId.value
  const typesenseSGId = outMap.typesenseSGId.value
  const webSGId = outMap.webSGId.value
  const webEcsSGId = outMap.webEcsSGId.value
  const sharedOutput: SharedInfraOutput = {
    assetBucket,
    assetBucketRole,
    dbHost,
    gqlECRRepo,
    redisHost,
    publicSubnets,
    privateSubnets,
    vpcId,
    typesenseSGId,
    webSGId,
    webEcsSGId,
  }
  const file = upath.joinSafe(__dirname, sharedOutputFileName)
  fs.writeFileSync(file, JSON.stringify(sharedOutput))
}

const main = async (): Promise<any> => {
  const args = process.argv.slice(2)
  const deployShared = args?.[0] === 'deploy:shared' || false
  const deployGQL = args?.[0] === 'deploy:gql' || false
  const deployStream = args?.[0] === 'deploy:stream' || false
  const deployCronjobs = args?.[0] === 'deploy:cronjobs' || false
  const deploySubstreams = args?.[0] === 'deploy:substreams' || false
  const deploySubstreamsInstance = args?.[0] === 'deploy:substreamsInstance' || false
  const deployTypesense = args?.[0] == 'deploy:typesense' || false
  // console.log(process.env.SECRETS)
  // console.log('COMMIT SHA8', process.env.GITHUB_SHA?.substring(0, 8))

  if (deployShared) {
    return createSharedInfra().then(sharedOutToJSONFile)
  }

  if (deployGQL) {
    return createGQLServer()
  }

  if (deployStream) {
    return createStreamCluster()
  }

  if (deployCronjobs) {
    return createCronJobs()
  }

  if (deploySubstreams) {
    return createSubStreams()
  }
  if (deploySubstreamsInstance) {
    return createSubStreamInstances()
  }

  if (deployTypesense) {
    return createTypesenseCluster()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
