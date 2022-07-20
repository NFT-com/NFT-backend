import * as console from 'console'
import fs from 'fs'
import * as process from 'process'
import * as upath from 'upath'

import * as pulumi from '@pulumi/pulumi'

import { SharedInfraOutput, sharedOutputFileName } from './defs'
import { createGQLServer, updateGQLEnvFile } from './gql'
import { createSharedInfra } from './shared'

export const sharedOutToJSONFile = (outMap: pulumi.automation.OutputMap): void => {
  const assetBucket = outMap.assetBucket.value
  const assetBucketRole = outMap.assetBucketRole.value
  const dbHost = outMap.dbHost.value
  const deployAppBucket = outMap.deployAppBucket.value
  const gqlECRRepo = outMap.gqlECRRepo.value
  const redisHost = outMap.redisHost.value
  const publicSubnets = outMap.publicSubnetIds.value
  const vpcId = outMap.vpcId.value
  const typesenseSGId = outMap.typesenseSGId.value
  const webSGId = outMap.webSGId.value
  const webEcsSGId = outMap.webEcsSGId.value
  const sharedOutput: SharedInfraOutput = {
    assetBucket,
    assetBucketRole,
    dbHost,
    deployAppBucket,
    gqlECRRepo,
    redisHost,
    publicSubnets,
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
  const buildGQLEnv = args?.[0] === 'gql:env' || false
  // console.log(process.env.SECRETS)
  // console.log('COMMIT SHA8', process.env.GITHUB_SHA?.substring(0, 8))

  if (deployShared) {
    return createSharedInfra()
      .then(sharedOutToJSONFile)
  }

  if (buildGQLEnv) {
    updateGQLEnvFile()
    return
  }

  if (deployGQL) {
    return createGQLServer()
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })

